"""Bias detection service using LangGraph workflow for interview transcript analysis."""

from typing import Dict, Any, List, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from src.services.bias_monitoring_workflow import BiasMonitoringWorkflowExecutor
from src.database.repositories.transcript_repository import TranscriptRepository
from src.database.models import SpeakerEnum
from src.utils.logger import get_logger

logger = get_logger("bias_detection_service")


class BiasDetectionService:
    """Service for LLM-based bias detection using LangGraph workflows."""

    def __init__(self, db: Session):
        """Initialize bias detection service.

        Args:
            db: Database session
        """
        self.db = db
        self.transcript_repo = TranscriptRepository(db)
        self.workflow_executor = BiasMonitoringWorkflowExecutor(db)

    async def analyze_transcript(
        self,
        transcript_id: int,
        interview_id: int,
        admin_id: str,
        transcript_text: str,
        conversation_context: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Analyze a transcript chunk for bias using LangGraph workflow.

        Args:
            transcript_id: ID of the transcript to analyze
            interview_id: ID of the interview
            admin_id: ID of the admin being monitored
            transcript_text: The text to analyze
            conversation_context: Recent conversation history for context

        Returns:
            Dictionary with bias analysis results and actions taken
        """
        try:
            # Build context string
            if conversation_context:
                context_str = "\n".join(conversation_context)
            else:
                # Fetch recent context from database
                context_str = self._get_context_from_db(interview_id)

            # Execute LangGraph workflow
            logger.info(f"Executing bias monitoring workflow for transcript {transcript_id}")
            final_state = await self.workflow_executor.execute(
                transcript_id=transcript_id,
                interview_id=interview_id,
                admin_id=admin_id,
                transcript_text=transcript_text,
                conversation_context=context_str,
            )

            # Check for errors
            if final_state.get("error"):
                logger.error(f"Workflow error: {final_state['error']}")
                raise Exception(final_state["error"])

            # Return comprehensive result
            return {
                "analysis_id": final_state.get("analysis_id"),
                "bias_detected": final_state.get("bias_detected", False),
                "severity": final_state.get("severity", "none"),
                "confidence_score": final_state.get("confidence_score", 0.0),
                "evidence_quotes": final_state.get("evidence_quotes"),
                "context_summary": final_state.get("context_summary"),
                "recommended_action": final_state.get("recommended_action", "none"),
                "actual_action": final_state.get("actual_action", "none"),
                "nudge_id": final_state.get("nudge_id"),
                "nudge_type": final_state.get("nudge_type"),
                "nudge_message": final_state.get("nudge_message"),
                "flag_id": final_state.get("flag_id"),
                "strike_count": final_state.get("strike_count", 0),
            }

        except Exception as e:
            logger.error(f"Bias detection failed: {str(e)}")
            raise

    def _get_context_from_db(self, interview_id: int, context_count: int = 5) -> str:
        """Fetch recent context from database.

        Args:
            interview_id: The interview ID
            context_count: Number of recent chunks to fetch

        Returns:
            Formatted context string
        """
        from datetime import timezone
        transcripts = self.transcript_repo.get_recent_context(
            interview_id=interview_id,
            before_time=datetime.now(timezone.utc),
            context_count=context_count,
        )

        # Reverse to chronological order
        transcripts.reverse()

        context_lines = []
        for t in transcripts:
            speaker_label = "EVALUATOR" if t.speaker == SpeakerEnum.ADMIN else "APPLICANT"
            context_lines.append(f"{speaker_label}: {t.transcript_text}")

        return "\n".join(context_lines) if context_lines else "(No prior context)"


class BatchBiasAnalyzer:
    """Batch analyzer for processing multiple transcripts at once."""

    def __init__(self, db: Session):
        """Initialize batch analyzer."""
        self.db = db
        self.detection_service = BiasDetectionService(db)

    async def analyze_interview_transcripts(
        self,
        interview_id: int,
        admin_id: str,
    ) -> List[Dict[str, Any]]:
        """Analyze all admin transcripts for an interview.

        Args:
            interview_id: The interview ID
            admin_id: The admin ID

        Returns:
            List of analysis results
        """
        transcript_repo = TranscriptRepository(self.db)

        # Get all admin transcripts
        transcripts = transcript_repo.get_by_interview_id(
            interview_id=interview_id,
            speaker=SpeakerEnum.ADMIN,
        )

        results = []
        for transcript in transcripts:
            try:
                result = await self.detection_service.analyze_transcript(
                    transcript_id=transcript.id,
                    interview_id=interview_id,
                    admin_id=admin_id,
                    transcript_text=transcript.transcript_text,
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to analyze transcript {transcript.id}: {str(e)}")
                continue

        return results
