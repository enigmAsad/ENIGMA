"""LangGraph workflow for real-time bias monitoring in interviews.

This workflow orchestrates the complete bias monitoring pipeline:
Audio → STT → Transcript Storage → Bias Analysis → Nudge Decision → Action
"""

import json
from typing import TypedDict, Annotated, Optional, Dict, Any, List
from datetime import datetime, timezone
import operator

from langgraph.graph import StateGraph, END
from openai import OpenAI
from sqlalchemy.orm import Session

from src.config.settings import get_settings

settings = get_settings()
from src.database.repositories.transcript_repository import TranscriptRepository
from src.database.repositories.bias_repository import (
    BiasAnalysisRepository,
    NudgeRepository,
    AdminBiasHistoryRepository,
)
from src.database.models import SeverityEnum, RecommendedActionEnum, NudgeTypeEnum
from src.utils.logger import get_logger

logger = get_logger("bias_monitoring_workflow")


# ============================================================================
# State Definition
# ============================================================================

class BiasMonitoringState(TypedDict):
    """State for the bias monitoring workflow."""

    # Input
    transcript_id: int
    interview_id: int
    admin_id: str
    transcript_text: str
    conversation_context: Optional[str]

    # Bias Analysis Results
    bias_detected: bool
    bias_types: Optional[List[str]]
    severity: str
    confidence_score: float
    evidence_quotes: Optional[List[str]]
    context_summary: Optional[str]
    recommended_action: str
    llm_response_raw: Optional[Dict[str, Any]]

    # Nudge Decision
    actual_action: str  # May differ from recommended based on strikes
    nudge_message: Optional[str]
    nudge_type: Optional[str]
    strike_count: int

    # Analysis Result
    analysis_id: Optional[int]
    nudge_id: Optional[int]
    flag_id: Optional[int]

    # Error Handling
    error: Optional[str]
    retry_count: Annotated[int, operator.add]


# ============================================================================
# Bias Detection Prompt
# ============================================================================

BIAS_DETECTION_SYSTEM_PROMPT = """You are an expert bias detection system monitoring an admission interview evaluator.

CONTEXT:
- This is a merit-based university admission interview
- The evaluator (admin) should focus ONLY on: communication skills, critical thinking, motivation, academic fit
- The evaluator MUST NOT reference: appearance, gender, name, accent, socioeconomic status, personal connections, or other irrelevant factors

RUBRIC VIOLATIONS (BIAS INDICATORS):
1. APPEARANCE: Comments on clothing, physical features, attractiveness, grooming
2. GENDER: References to gender identity, gender stereotypes, or gender-based assumptions
3. NAME: Assumptions or comments based on name origin, ethnicity suggested by name
4. ACCENT: Negative comments about pronunciation, dialect, or language proficiency unrelated to communication clarity
5. SOCIOECONOMIC: Judgments based on wealth indicators, family background, neighborhood, or economic status
6. PERSONAL_CONNECTION: Mentions of shared contacts, family ties, alumni relations, or favoritism
7. IRRELEVANT_FACTOR: Any non-merit discussion unrelated to academic qualifications

Your task is to determine if the evaluator's statement contains bias. Be context-aware and avoid false positives:
- Legitimate questions about communication skills are NOT bias
- Discussing challenges the applicant faced (e.g., discrimination) is NOT bias
- Clarifying factual information is NOT bias

Respond with a JSON object containing your analysis."""


BIAS_DETECTION_USER_PROMPT_TEMPLATE = """CONVERSATION HISTORY:
{context}

CURRENT EVALUATOR STATEMENT:
"{transcript}"

Provide your analysis in the following JSON format:
{{
  "bias_detected": true/false,
  "bias_types": ["appearance", "gender", "name", "accent", "socioeconomic", "personal_connection", "irrelevant_factor"],
  "severity": "none/low/medium/high/critical",
  "confidence_score": 0.0-1.0,
  "evidence_quotes": ["exact quote 1", "exact quote 2"],
  "context_summary": "Explanation of why this is or isn't bias, considering context",
  "recommended_action": "none/nudge/warn/block"
}}

SEVERITY GUIDELINES:
- NONE: No bias detected
- LOW: Subtle or ambiguous statement that could be innocent but warrants awareness
- MEDIUM: Clear bias indicator but may be unintentional, educate the evaluator
- HIGH: Explicit bias that violates merit-based principles, requires warning
- CRITICAL: Severe or repeated bias that compromises evaluation integrity, block interview

RECOMMENDED ACTION GUIDELINES:
- NONE: No bias detected, no action needed
- NUDGE: Low severity, show informational banner (blue)
- WARN: Medium/High severity, show warning alert (yellow), add strike
- BLOCK: Critical severity or 3+ strikes in session, terminate interview (red)

Respond with ONLY the JSON object, no additional text."""


# ============================================================================
# Workflow Nodes
# ============================================================================

def analyze_bias_node(state: BiasMonitoringState) -> BiasMonitoringState:
    """Node: Analyze transcript for bias using LLM.

    Args:
        state: Current workflow state

    Returns:
        Updated state with analysis results
    """
    try:
        logger.info(f"Analyzing transcript {state['transcript_id']} for bias")

        # Initialize OpenAI client
        client = OpenAI(api_key=settings.openai_api_key)

        # Build prompt
        user_prompt = BIAS_DETECTION_USER_PROMPT_TEMPLATE.format(
            context=state.get("conversation_context", "(No prior context)"),
            transcript=state["transcript_text"],
        )

        # Call OpenAI API with JSON mode
        messages = [
            {"role": "system", "content": BIAS_DETECTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        response = client.chat.completions.create(
            model=settings.bias_detection_model,
            messages=messages,
            response_format={"type": "json_object"},
        )

        # Parse response
        analysis_result = json.loads(response.choices[0].message.content)

        logger.info(f"Bias analysis result: bias_detected={analysis_result.get('bias_detected')}, "
                   f"severity={analysis_result.get('severity')}")

        # Update state
        return {
            **state,
            "bias_detected": analysis_result.get("bias_detected", False),
            "bias_types": analysis_result.get("bias_types"),
            "severity": analysis_result.get("severity", "none"),
            "confidence_score": analysis_result.get("confidence_score", 0.0),
            "evidence_quotes": analysis_result.get("evidence_quotes"),
            "context_summary": analysis_result.get("context_summary"),
            "recommended_action": analysis_result.get("recommended_action", "none"),
            "llm_response_raw": analysis_result,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {str(e)}")
        return {**state, "error": f"JSON parse error: {str(e)}"}

    except Exception as e:
        logger.error(f"Bias analysis failed: {str(e)}")
        return {**state, "error": str(e)}


def store_analysis_node(state: BiasMonitoringState, db: Session) -> BiasMonitoringState:
    """Node: Store bias analysis in database.

    Args:
        state: Current workflow state
        db: Database session

    Returns:
        Updated state with analysis_id
    """
    if state.get("error"):
        return state

    try:
        analysis_repo = BiasAnalysisRepository(db)

        analysis = analysis_repo.create_analysis(
            transcript_id=state["transcript_id"],
            interview_id=state["interview_id"],
            admin_id=state["admin_id"],
            bias_detected=state["bias_detected"],
            bias_types=state.get("bias_types"),
            severity=SeverityEnum(state["severity"]),
            confidence_score=state["confidence_score"],
            evidence_quotes=state.get("evidence_quotes"),
            context_summary=state.get("context_summary"),
            recommended_action=RecommendedActionEnum(state["recommended_action"]),
            llm_model=settings.bias_detection_model,
            llm_response_raw=state.get("llm_response_raw"),
        )

        db.commit()
        logger.info(f"Stored bias analysis {analysis.id}")

        return {**state, "analysis_id": analysis.id}

    except Exception as e:
        logger.error(f"Failed to store analysis: {str(e)}")
        db.rollback()
        return {**state, "error": str(e)}


def check_strikes_node(state: BiasMonitoringState, db: Session) -> BiasMonitoringState:
    """Node: Check admin strikes and determine actual action.

    Args:
        state: Current workflow state
        db: Database session

    Returns:
        Updated state with actual_action
    """
    if state.get("error") or not state.get("bias_detected"):
        return {**state, "actual_action": "none", "strike_count": 0}

    try:
        # Count strikes in this interview
        nudge_repo = NudgeRepository(db)
        counts = nudge_repo.count_by_type(
            admin_id=state["admin_id"],
            interview_id=state["interview_id"],
        )
        strike_count = counts.get("warning", 0) + counts.get("block", 0)

        # Check admin history
        history_repo = AdminBiasHistoryRepository(db)
        history = history_repo.get_or_create(state["admin_id"])

        # Determine action
        recommended = state["recommended_action"]
        actual_action = recommended

        # Auto-block conditions
        if strike_count >= settings.STRIKE_LIMIT_PER_INTERVIEW:
            actual_action = "block"
            logger.warning(f"Admin {state['admin_id']} hit strike limit in interview")
        elif history.current_status.value in ["suspended", "banned"]:
            actual_action = "block"
            logger.warning(f"Admin {state['admin_id']} is {history.current_status.value}")
        elif state["severity"] == "critical":
            actual_action = "block"

        # Confidence threshold check
        thresholds = {
            "nudge": settings.NUDGE_THRESHOLD_LOW,
            "warn": settings.NUDGE_THRESHOLD_MEDIUM,
            "block": settings.NUDGE_THRESHOLD_HIGH,
        }

        required_confidence = thresholds.get(actual_action, 0.0)
        if state["confidence_score"] < required_confidence:
            # Downgrade if confidence too low
            if actual_action == "block":
                actual_action = "warn"
            elif actual_action == "warn":
                actual_action = "nudge"
            elif actual_action == "nudge":
                actual_action = "none"

        return {
            **state,
            "actual_action": actual_action,
            "strike_count": strike_count,
        }

    except Exception as e:
        logger.error(f"Failed to check strikes: {str(e)}")
        return {**state, "error": str(e)}


def should_take_action(state: BiasMonitoringState) -> str:
    """Conditional edge: Determine if action should be taken.

    Args:
        state: Current workflow state

    Returns:
        Next node name
    """
    if state.get("error"):
        return "end"

    action = state.get("actual_action", "none")
    if action == "none":
        return "end"

    return "take_action"


async def take_action_node(state: BiasMonitoringState, db: Session) -> BiasMonitoringState:
    """Node: Execute the determined action (nudge/warn/block).

    Args:
        state: Current workflow state
        db: Database session

    Returns:
        Updated state with nudge/flag details
    """
    if state.get("error"):
        return state

    try:
        from src.services.nudge_service import NudgeService

        nudge_service = NudgeService(db)

        result = await nudge_service.process_bias_detection(
            analysis_id=state["analysis_id"],
            interview_id=state["interview_id"],
            admin_id=state["admin_id"],
            bias_detected=state["bias_detected"],
            severity=SeverityEnum(state["severity"]),
            recommended_action=RecommendedActionEnum(state["recommended_action"]),
            confidence_score=state["confidence_score"],
            bias_types=state.get("bias_types"),
            evidence={
                "transcript_id": state["transcript_id"],
                "analysis_id": state["analysis_id"],
                "evidence_quotes": state.get("evidence_quotes"),
            },
        )

        if result:
            return {
                **state,
                "nudge_id": result.get("nudge_id"),
                "nudge_type": result.get("nudge_type"),
                "nudge_message": result.get("message"),
                "flag_id": result.get("flag_id"),
            }

        return state

    except Exception as e:
        logger.error(f"Failed to take action: {str(e)}")
        return {**state, "error": str(e)}


# ============================================================================
# Workflow Builder
# ============================================================================

def create_bias_monitoring_workflow(db: Session) -> StateGraph:
    """Create the bias monitoring LangGraph workflow.

    Args:
        db: Database session

    Returns:
        Compiled StateGraph
    """
    # Create graph
    workflow = StateGraph(BiasMonitoringState)

    # Add nodes
    workflow.add_node("analyze_bias", analyze_bias_node)
    workflow.add_node("store_analysis", lambda state: store_analysis_node(state, db))
    workflow.add_node("check_strikes", lambda state: check_strikes_node(state, db))

    # Async wrapper for take_action_node
    async def take_action_wrapper(state):
        return await take_action_node(state, db)

    workflow.add_node("take_action", take_action_wrapper)

    # Define edges
    workflow.set_entry_point("analyze_bias")
    workflow.add_edge("analyze_bias", "store_analysis")
    workflow.add_edge("store_analysis", "check_strikes")

    # Conditional edge: only take action if needed
    workflow.add_conditional_edges(
        "check_strikes",
        should_take_action,
        {
            "take_action": "take_action",
            "end": END,
        }
    )

    workflow.add_edge("take_action", END)

    return workflow.compile()


# ============================================================================
# Workflow Executor
# ============================================================================

class BiasMonitoringWorkflowExecutor:
    """Executor for the bias monitoring workflow."""

    def __init__(self, db: Session):
        """Initialize executor.

        Args:
            db: Database session
        """
        self.db = db
        self.workflow = create_bias_monitoring_workflow(db)

    async def execute(
        self,
        transcript_id: int,
        interview_id: int,
        admin_id: str,
        transcript_text: str,
        conversation_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute the bias monitoring workflow.

        Args:
            transcript_id: ID of the transcript
            interview_id: ID of the interview
            admin_id: ID of the admin
            transcript_text: The transcript text
            conversation_context: Optional conversation context

        Returns:
            Final state dictionary
        """
        # Initial state
        initial_state = BiasMonitoringState(
            transcript_id=transcript_id,
            interview_id=interview_id,
            admin_id=admin_id,
            transcript_text=transcript_text,
            conversation_context=conversation_context,
            bias_detected=False,
            bias_types=None,
            severity="none",
            confidence_score=0.0,
            evidence_quotes=None,
            context_summary=None,
            recommended_action="none",
            llm_response_raw=None,
            actual_action="none",
            nudge_message=None,
            nudge_type=None,
            strike_count=0,
            analysis_id=None,
            nudge_id=None,
            flag_id=None,
            error=None,
            retry_count=0,
        )

        # Execute workflow
        logger.info(f"Executing bias monitoring workflow for transcript {transcript_id}")
        final_state = await self.workflow.ainvoke(initial_state)

        return final_state
