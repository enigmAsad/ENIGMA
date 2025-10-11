"""LangGraph orchestration pipeline for Phase 1 evaluation."""

from typing import Dict, Any, TypedDict, Annotated, Literal
from datetime import datetime
import operator

from langgraph.graph import StateGraph, END
from pydantic import BaseModel

from src.models.schemas import (
    Application,
    AnonymizedApplication,
    WorkerResult,
    JudgeResult,
    FinalScore,
    ApplicationStatus,
    JudgeDecision,
    PipelineState
)
from src.services.application_collector import ApplicationCollector
from src.services.identity_scrubber import IdentityScrubber
from src.services.worker_llm import WorkerLLM
from src.services.judge_llm import JudgeLLM
from src.services.hash_chain import HashChainGenerator
from src.services.email_service import EmailService
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger, AuditLogger
from src.config.settings import get_settings


logger = get_logger("phase1_pipeline")


class Phase1Pipeline:
    """LangGraph state machine for Phase 1 evaluation pipeline."""

    def __init__(
        self,
        csv_handler: CSVHandler,
        audit_logger: AuditLogger,
        application_collector: ApplicationCollector,
        identity_scrubber: IdentityScrubber,
        worker_llm: WorkerLLM,
        judge_llm: JudgeLLM,
        hash_chain: HashChainGenerator,
        email_service: EmailService
    ):
        """Initialize Phase 1 pipeline.

        Args:
            csv_handler: CSVHandler instance
            audit_logger: AuditLogger instance
            application_collector: ApplicationCollector instance
            identity_scrubber: IdentityScrubber instance
            worker_llm: WorkerLLM instance
            judge_llm: JudgeLLM instance
            hash_chain: HashChainGenerator instance
            email_service: EmailService instance
        """
        self.settings = get_settings()
        self.csv_handler = csv_handler
        self.audit_logger = audit_logger
        self.app_collector = application_collector
        self.identity_scrubber = identity_scrubber
        self.worker_llm = worker_llm
        self.judge_llm = judge_llm
        self.hash_chain = hash_chain
        self.email_service = email_service

        # Build the state graph
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine.

        Returns:
            StateGraph: Compiled state graph
        """
        # Define state graph
        workflow = StateGraph(PipelineState)

        # Add nodes (each node is a processing step)
        workflow.add_node("scrub_identity", self._scrub_identity_node)
        workflow.add_node("worker_evaluation", self._worker_evaluation_node)
        workflow.add_node("judge_review", self._judge_review_node)
        workflow.add_node("final_scoring", self._final_scoring_node)
        workflow.add_node("hash_generation", self._hash_generation_node)
        workflow.add_node("send_notification", self._send_notification_node)

        # Set entry point
        workflow.set_entry_point("scrub_identity")

        # Add edges
        workflow.add_edge("scrub_identity", "worker_evaluation")
        workflow.add_edge("worker_evaluation", "judge_review")

        # Conditional edge from judge_review
        workflow.add_conditional_edges(
            "judge_review",
            self._decision_gate,
            {
                "retry": "worker_evaluation",
                "approve": "final_scoring",
                "fail": END
            }
        )

        workflow.add_edge("final_scoring", "hash_generation")
        workflow.add_edge("hash_generation", "send_notification")
        workflow.add_edge("send_notification", END)

        # Compile graph
        return workflow.compile()

    def _scrub_identity_node(self, state: PipelineState) -> PipelineState:
        """Node: Scrub identity and create anonymized application.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        logger.info(f"[{state.application_id}] Starting identity scrubbing")

        try:
            # Get application
            application = state.application_data
            if not application:
                application = self.csv_handler.get_application_by_id(state.application_id)
                if not application:
                    raise ValueError(f"Application not found: {state.application_id}")

            # Scrub identity
            anonymized = self.identity_scrubber.scrub_application(application)

            # Update state
            state.anonymized_id = anonymized.anonymized_id
            state.anonymized_data = anonymized
            state.status = ApplicationStatus.WORKER_EVALUATION
            state.updated_at = datetime.utcnow()

            logger.info(
                f"[{state.application_id}] Identity scrubbing complete → {anonymized.anonymized_id}"
            )

        except Exception as e:
            logger.error(f"[{state.application_id}] Identity scrubbing failed: {e}")
            state.error = str(e)
            state.status = ApplicationStatus.FAILED

        return state

    def _worker_evaluation_node(self, state: PipelineState) -> PipelineState:
        """Node: Worker LLM evaluation.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        state.worker_attempt += 1
        attempt = state.worker_attempt

        logger.info(
            f"[{state.application_id}] Starting worker evaluation (attempt {attempt}/{state.max_attempts})"
        )

        try:
            # Get judge feedback if this is a retry
            judge_feedback = None
            if attempt > 1 and state.judge_result:
                judge_feedback = state.judge_result.feedback

            # Evaluate
            worker_result = self.worker_llm.evaluate(
                application=state.anonymized_data,
                attempt_number=attempt,
                judge_feedback=judge_feedback
            )

            # Update state
            state.worker_result = worker_result
            state.status = ApplicationStatus.JUDGE_REVIEW
            state.updated_at = datetime.utcnow()

            logger.info(
                f"[{state.application_id}] Worker evaluation complete "
                f"(attempt {attempt}): {worker_result.total_score:.2f}/100"
            )

        except Exception as e:
            logger.error(f"[{state.application_id}] Worker evaluation failed: {e}")
            state.error = str(e)
            state.status = ApplicationStatus.FAILED

        return state

    def _judge_review_node(self, state: PipelineState) -> PipelineState:
        """Node: Judge LLM validation.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        logger.info(f"[{state.application_id}] Starting judge review")

        try:
            # Validate
            judge_result = self.judge_llm.validate(
                application=state.anonymized_data,
                worker_result=state.worker_result
            )

            # Update state
            state.judge_result = judge_result
            state.updated_at = datetime.utcnow()

            decision_str = "APPROVED" if judge_result.decision == JudgeDecision.APPROVED else "REJECTED"
            logger.info(
                f"[{state.application_id}] Judge review complete: {decision_str} "
                f"(quality: {judge_result.quality_score:.0f}/100)"
            )

        except Exception as e:
            logger.error(f"[{state.application_id}] Judge review failed: {e}")
            state.error = str(e)
            state.status = ApplicationStatus.FAILED

        return state

    def _decision_gate(self, state: PipelineState) -> Literal["retry", "approve", "fail"]:
        """Conditional edge: Decide whether to retry or proceed.

        Args:
            state: Current pipeline state

        Returns:
            str: Next node to execute
        """
        if not state.judge_result:
            logger.error(f"[{state.application_id}] No judge result in decision gate")
            return "fail"

        # If approved, proceed
        if state.judge_result.decision == JudgeDecision.APPROVED:
            logger.info(f"[{state.application_id}] Decision: APPROVED → final scoring")
            return "approve"

        # If rejected and under max attempts, retry
        if state.worker_attempt < state.max_attempts:
            logger.info(
                f"[{state.application_id}] Decision: REJECTED → retry "
                f"({state.worker_attempt}/{state.max_attempts})"
            )
            return "retry"

        # Max attempts reached, fail
        logger.warning(
            f"[{state.application_id}] Decision: FAILED "
            f"(max attempts {state.max_attempts} reached)"
        )
        state.status = ApplicationStatus.FAILED
        state.error = f"Failed after {state.max_attempts} worker attempts"
        return "fail"

    def _final_scoring_node(self, state: PipelineState) -> PipelineState:
        """Node: Create final score.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        logger.info(f"[{state.application_id}] Creating final score")

        try:
            worker_result = state.worker_result

            # Create final score
            final_score = FinalScore(
                anonymized_id=state.anonymized_id,
                final_score=worker_result.total_score,
                academic_score=worker_result.academic_score,
                test_score=worker_result.test_score,
                achievement_score=worker_result.achievement_score,
                essay_score=worker_result.essay_score,
                explanation=worker_result.explanation,
                strengths=self._extract_strengths(worker_result),
                areas_for_improvement=self._extract_improvements(worker_result),
                worker_attempts=state.worker_attempt,
                timestamp=datetime.utcnow()
            )

            # Persist final score
            self.csv_handler.append_final_score(final_score)

            # Update state
            state.final_score = final_score
            state.status = ApplicationStatus.HASH_GENERATION
            state.updated_at = datetime.utcnow()

            # Audit log
            self.audit_logger.log_final_scoring(
                anonymized_id=state.anonymized_id,
                final_score=final_score.final_score,
                attempts=state.worker_attempt
            )

            logger.info(
                f"[{state.application_id}] Final score created: {final_score.final_score:.2f}/100"
            )

        except Exception as e:
            logger.error(f"[{state.application_id}] Final scoring failed: {e}")
            state.error = str(e)
            state.status = ApplicationStatus.FAILED

        return state

    def _hash_generation_node(self, state: PipelineState) -> PipelineState:
        """Node: Generate hash chain entry.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        logger.info(f"[{state.application_id}] Generating hash chain entry")

        try:
            # Generate hash
            hash_value = self.hash_chain.create_phase1_hash(state.final_score)

            # Update final score with hash
            state.final_score.hash = hash_value
            state.hash = hash_value
            state.status = ApplicationStatus.NOTIFICATION
            state.updated_at = datetime.utcnow()

            logger.info(f"[{state.application_id}] Hash generated: {hash_value[:16]}...")

        except Exception as e:
            logger.error(f"[{state.application_id}] Hash generation failed: {e}")
            state.error = str(e)
            state.status = ApplicationStatus.FAILED

        return state

    def _send_notification_node(self, state: PipelineState) -> PipelineState:
        """Node: Send email notification.

        Args:
            state: Current pipeline state

        Returns:
            PipelineState: Updated state
        """
        logger.info(f"[{state.application_id}] Sending notification")

        try:
            # Retrieve identity
            identity = self.identity_scrubber.retrieve_identity(state.anonymized_id)
            if not identity:
                logger.warning(f"[{state.application_id}] Could not retrieve identity for notification")
                state.status = ApplicationStatus.COMPLETED
                return state

            # Send final results email
            self.email_service.send_final_results(
                to_email=identity["email"],
                applicant_name=identity["name"],
                application_id=state.application_id,
                anonymized_id=state.anonymized_id,
                final_score=state.final_score.final_score,
                explanation=state.final_score.explanation,
                verification_hash=state.hash
            )

            # Update state
            state.status = ApplicationStatus.COMPLETED
            state.updated_at = datetime.utcnow()

            logger.info(f"[{state.application_id}] Pipeline complete!")

        except Exception as e:
            logger.error(f"[{state.application_id}] Notification failed: {e}")
            # Don't fail the whole pipeline if notification fails
            state.status = ApplicationStatus.COMPLETED
            logger.warning(f"[{state.application_id}] Completed despite notification failure")

        return state

    def _extract_strengths(self, worker_result: WorkerResult) -> list:
        """Extract strengths from worker result.

        Args:
            worker_result: Worker evaluation result

        Returns:
            list: List of strength descriptions
        """
        strengths = []

        # Identify high-scoring areas
        if worker_result.academic_score >= 80:
            strengths.append(f"Strong academic performance ({worker_result.academic_score:.0f}/100)")
        if worker_result.test_score >= 80:
            strengths.append(f"Excellent test scores ({worker_result.test_score:.0f}/100)")
        if worker_result.achievement_score >= 80:
            strengths.append(f"Outstanding achievements ({worker_result.achievement_score:.0f}/100)")
        if worker_result.essay_score >= 80:
            strengths.append(f"Compelling essay ({worker_result.essay_score:.0f}/100)")

        # Ensure at least one strength
        if not strengths:
            strengths.append("Completed application with measurable achievements")

        return strengths

    def _extract_improvements(self, worker_result: WorkerResult) -> list:
        """Extract areas for improvement from worker result.

        Args:
            worker_result: Worker evaluation result

        Returns:
            list: List of improvement area descriptions
        """
        improvements = []

        # Identify lower-scoring areas
        if worker_result.academic_score < 70:
            improvements.append("Academic performance could be strengthened")
        if worker_result.test_score < 70:
            improvements.append("Standardized test scores have room for improvement")
        if worker_result.achievement_score < 70:
            improvements.append("Additional achievements and leadership would strengthen profile")
        if worker_result.essay_score < 70:
            improvements.append("Essay could demonstrate deeper critical thinking")

        # Ensure at least one improvement
        if not improvements:
            improvements.append("Continue building on existing strengths")

        return improvements

    def run(self, application: Application) -> PipelineState:
        """Run the complete Phase 1 pipeline for an application.

        Args:
            application: Application to process

        Returns:
            PipelineState: Final pipeline state
        """
        logger.info(f"[{application.application_id}] Starting Phase 1 pipeline")

        # Initialize state
        initial_state = PipelineState(
            application_id=application.application_id,
            application_data=application,
            max_attempts=self.settings.max_retry_attempts,
            status=ApplicationStatus.IDENTITY_SCRUBBING
        )

        # Run graph
        try:
            final_state = self.graph.invoke(initial_state)

            if final_state.status == ApplicationStatus.COMPLETED:
                logger.info(
                    f"[{application.application_id}] Pipeline completed successfully! "
                    f"Final score: {final_state.final_score.final_score:.2f}/100"
                )
            else:
                logger.error(
                    f"[{application.application_id}] Pipeline failed: {final_state.error}"
                )

            return final_state

        except Exception as e:
            logger.error(f"[{application.application_id}] Pipeline execution failed: {e}")
            initial_state.status = ApplicationStatus.FAILED
            initial_state.error = str(e)
            return initial_state


def run_pipeline(application: Application) -> PipelineState:
    """Convenience function to run Phase 1 pipeline.

    Args:
        application: Application to process

    Returns:
        PipelineState: Final pipeline state
    """
    # Initialize all components
    csv_handler = CSVHandler()
    audit_logger = AuditLogger(csv_handler=csv_handler)

    app_collector = ApplicationCollector(
        csv_handler=csv_handler,
        audit_logger=audit_logger
    )

    identity_scrubber = IdentityScrubber(
        csv_handler=csv_handler,
        audit_logger=audit_logger
    )

    worker_llm = WorkerLLM(
        csv_handler=csv_handler,
        audit_logger=audit_logger
    )

    judge_llm = JudgeLLM(
        csv_handler=csv_handler,
        audit_logger=audit_logger
    )

    hash_chain = HashChainGenerator(
        csv_handler=csv_handler,
        audit_logger=audit_logger
    )

    email_service = EmailService(audit_logger=audit_logger)

    # Create and run pipeline
    pipeline = Phase1Pipeline(
        csv_handler=csv_handler,
        audit_logger=audit_logger,
        application_collector=app_collector,
        identity_scrubber=identity_scrubber,
        worker_llm=worker_llm,
        judge_llm=judge_llm,
        hash_chain=hash_chain,
        email_service=email_service
    )

    return pipeline.run(application)
