"""Phase transition manager for admission cycle workflow.

Manages the 9-phase workflow:
1. Submission - Accepting applications
2. Frozen - Data locked
3. Preprocessing - Computing metrics
4. Batch Prep - Exporting JSONL
5. Processing - LLM batch running
6. Scored - Results integrated
7. Selection - Top-K selection
8. Published - Results available
9. Completed - Cycle closed
"""

from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from src.database.repositories import AdminRepository, ApplicationRepository
from src.database.models import (
    AdmissionCycle, AdmissionPhaseEnum, ApplicationStatusEnum, Application
)
from src.utils.logger import get_logger

logger = get_logger("phase_manager")


class PhaseTransitionError(Exception):
    """Raised when phase transition is invalid."""
    pass


class PhaseManager:
    """Manager for admission cycle phase transitions."""

    def __init__(self, db: Session):
        """Initialize phase manager.

        Args:
            db: Database session
        """
        self.db = db
        self.admin_repo = AdminRepository(db)
        self.app_repo = ApplicationRepository(db)

    def freeze_cycle(self, cycle_id: str, closed_by_id: str) -> AdmissionCycle:
        """Transition from SUBMISSION to FROZEN phase.

        Phase 1 → Phase 2: Data Freeze

        Actions:
        - Close submissions (is_open = False)
        - Mark all submitted applications as finalized
        - Create database snapshot (recommended in production)

        Args:
            cycle_id: Cycle ID to freeze

        Returns:
            AdmissionCycle: Updated cycle

        Raises:
            PhaseTransitionError: If transition is invalid
        """
        logger.info(f"Freezing cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.SUBMISSION:
            raise PhaseTransitionError(
                f"Can only freeze from SUBMISSION phase, currently in {cycle.phase.value}"
            )

        # Close cycle to submissions. This sets is_open = False.
        cycle = self.admin_repo.close_cycle(cycle_id, closed_by_id)
        if not cycle:
            raise PhaseTransitionError(f"Failed to close cycle {cycle_id}")

        # Finalize all submitted applications
        finalized_count = self.app_repo.finalize_applications(cycle_id)
        logger.info(f"Finalized {finalized_count} applications")

        # Update phase to FROZEN
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.FROZEN)

        self.db.commit()

        logger.info(f"Cycle {cycle_id} frozen successfully")
        return cycle

    def start_preprocessing(self, cycle_id: str) -> AdmissionCycle:
        """Transition from FROZEN to PREPROCESSING phase.

        Phase 2 → Phase 3: Merit Pre-Processing

        Actions:
        - Compute deterministic metrics for all finalized applications
        - Calculate test averages, academic scores, percentiles

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle

        Raises:
            PhaseTransitionError: If transition is invalid
        """
        logger.info(f"Starting preprocessing for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.FROZEN:
            raise PhaseTransitionError(
                f"Can only preprocess from FROZEN phase, currently in {cycle.phase.value}"
            )

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.PREPROCESSING)

        # Compute deterministic metrics for all finalized applications
        applications = self.app_repo.get_by_cycle(
            cycle_id,
            status=ApplicationStatusEnum.FINALIZED,
            limit=100000
        )

        computed_count = 0
        for app in applications:
            # Check if metrics already exist
            existing_metrics = self.app_repo.get_deterministic_metrics(app.application_id)
            if existing_metrics:
                continue

            # Compute test average
            test_scores = app.test_scores
            if test_scores:
                test_average = sum(test_scores.values()) / len(test_scores)
            else:
                test_average = 0.0

            # Normalize GPA to 0-100 scale
            academic_score_computed = (app.gpa / 4.0) * 100.0

            # Create metrics
            self.app_repo.create_deterministic_metrics(
                application_id=app.application_id,
                test_average=test_average,
                academic_score_computed=academic_score_computed
            )
            computed_count += 1

        # TODO: Compute percentile ranks
        # self.app_repo.compute_percentile_ranks(cycle_id)

        # Update application statuses
        from sqlalchemy import update
        stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status == ApplicationStatusEnum.FINALIZED
            )
            .values(status=ApplicationStatusEnum.PREPROCESSING)
        )
        self.db.execute(stmt)

        self.db.commit()

        logger.info(f"Computed metrics for {computed_count} applications")
        return cycle

    def start_batch_prep(self, cycle_id: str) -> AdmissionCycle:
        """Transition from PREPROCESSING to BATCH_PREP phase.

        Phase 3 → Phase 4: Batch Preparation

        Actions:
        - Mark applications as ready for batch export
        - Update phase to BATCH_PREP

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle
        """
        logger.info(f"Starting batch prep for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.PREPROCESSING:
            raise PhaseTransitionError(
                f"Can only start batch prep from PREPROCESSING phase"
            )

        # Update application statuses to BATCH_READY
        from sqlalchemy import update
        stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status == ApplicationStatusEnum.PREPROCESSING
            )
            .values(status=ApplicationStatusEnum.BATCH_READY)
        )
        result = self.db.execute(stmt)
        batch_ready_count = result.rowcount

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.BATCH_PREP)

        self.db.commit()

        logger.info(f"{batch_ready_count} applications ready for batch processing")
        return cycle

    def start_processing(self, cycle_id: str) -> AdmissionCycle:
        """Transition from BATCH_PREP to PROCESSING phase.

        Phase 4 → Phase 5: LLM Batch Processing

        Actions:
        - Mark phase as PROCESSING
        - Applications marked as PROCESSING

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle
        """
        logger.info(f"Starting processing for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.BATCH_PREP:
            raise PhaseTransitionError(
                f"Can only start processing from BATCH_PREP phase"
            )

        # Update application statuses
        from sqlalchemy import update
        stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status == ApplicationStatusEnum.BATCH_READY
            )
            .values(status=ApplicationStatusEnum.PROCESSING)
        )
        self.db.execute(stmt)

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.PROCESSING)

        self.db.commit()

        logger.info(f"Cycle {cycle_id} now in PROCESSING phase")
        return cycle

    def mark_scored(self, cycle_id: str) -> AdmissionCycle:
        """Transition from PROCESSING to SCORED phase.

        Phase 5 → Phase 6: Results Integrated

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle
        """
        logger.info(f"Marking cycle {cycle_id} as scored")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.PROCESSING:
            raise PhaseTransitionError(
                f"Can only mark scored from PROCESSING phase"
            )

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.SCORED)

        self.db.commit()

        logger.info(f"Cycle {cycle_id} marked as SCORED")
        return cycle

    def perform_selection(
        self,
        cycle_id: str,
        executed_by: str,
        selection_strategy: str = "top_k"
    ) -> Dict[str, Any]:
        """Transition from SCORED to SELECTION phase.

        Phase 6 → Phase 7: Top-K Selection

        Actions:
        - Select top applicants based on final_score
        - Update final_scores table with selection status
        - Create selection log

        Args:
            cycle_id: Cycle ID
            executed_by: Admin ID
            selection_strategy: Selection strategy (default: "top_k")

        Returns:
            Dict[str, Any]: Selection results
        """
        logger.info(f"Performing selection for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.SCORED:
            raise PhaseTransitionError(
                f"Can only perform selection from SCORED phase"
            )

        # Get top N final scores
        max_seats = cycle.max_seats
        top_scores = self.app_repo.get_top_scores(cycle_id, limit=max_seats)

        if not top_scores:
            raise PhaseTransitionError("No scored applications found")

        # Mark top applicants as SELECTED
        selected_count = 0
        cutoff_score = None

        for score in top_scores:
            self.app_repo.update_final_score_status(
                score.anonymized_id,
                ApplicationStatusEnum.SELECTED
            )
            selected_count += 1
            cutoff_score = score.final_score

        # Mark remaining as NOT_SELECTED
        from sqlalchemy import update
        from src.database.models import FinalScore, AnonymizedApplication

        # Get all scored but not selected
        not_selected_stmt = (
            update(FinalScore)
            .where(
                FinalScore.status == ApplicationStatusEnum.SCORED,
                FinalScore.anonymized_id.in_(
                    select(AnonymizedApplication.anonymized_id)
                    .join(Application, AnonymizedApplication.application_id == Application.application_id)
                    .where(Application.admission_cycle_id == cycle_id)
                )
            )
            .values(status=ApplicationStatusEnum.NOT_SELECTED)
        )
        result = self.db.execute(not_selected_stmt)
        not_selected_count = result.rowcount

        # Update cycle selected_count
        self.admin_repo.update_selected_count(cycle_id, selected_count)

        # Create selection log
        selection_criteria = {
            "strategy": selection_strategy,
            "max_seats": max_seats,
            "selected": selected_count,
            "not_selected": not_selected_count,
            "cutoff_score": cutoff_score
        }

        self.admin_repo.create_selection_log(
            admission_cycle_id=cycle_id,
            selected_count=selected_count,
            selection_criteria=selection_criteria,
            cutoff_score=cutoff_score or 0.0,
            executed_by=executed_by
        )

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.SELECTION)

        self.db.commit()

        logger.info(
            f"Selection complete: {selected_count} selected, {not_selected_count} not selected"
        )

        return {
            "selected_count": selected_count,
            "not_selected_count": not_selected_count,
            "cutoff_score": cutoff_score,
            "selection_criteria": selection_criteria
        }

    def publish_results(self, cycle_id: str) -> AdmissionCycle:
        """Transition from SELECTION to PUBLISHED phase.

        Phase 7 → Phase 8: Results Published

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle
        """
        logger.info(f"Publishing results for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.SELECTION:
            raise PhaseTransitionError(
                f"Can only publish from SELECTION phase"
            )

        # Mark all selected/not_selected applications as PUBLISHED
        from sqlalchemy import update
        stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status.in_([
                    ApplicationStatusEnum.SELECTED,
                    ApplicationStatusEnum.NOT_SELECTED
                ])
            )
            .values(status=ApplicationStatusEnum.PUBLISHED)
        )
        self.db.execute(stmt)

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.PUBLISHED)

        self.db.commit()

        logger.info(f"Results published for cycle {cycle_id}")
        return cycle

    def complete_cycle(self, cycle_id: str, closed_by: str) -> AdmissionCycle:
        """Transition from PUBLISHED to COMPLETED phase.

        Phase 8 → Phase 9: Cycle Completed

        Args:
            cycle_id: Cycle ID
            closed_by: Admin ID

        Returns:
            AdmissionCycle: Updated cycle
        """
        logger.info(f"Completing cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.PUBLISHED:
            raise PhaseTransitionError(
                f"Can only complete from PUBLISHED phase"
            )

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.COMPLETED)

        # Update closed_by if not already set
        if not cycle.closed_by:
            cycle = self.admin_repo.close_cycle(cycle_id, closed_by)

        self.db.commit()

        logger.info(f"Cycle {cycle_id} completed")
        return cycle

    def get_cycle_status(self, cycle_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive cycle status.

        Args:
            cycle_id: Cycle ID

        Returns:
            Optional[Dict]: Cycle status info
        """
        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            return None

        # Get application counts by status
        total_apps = self.app_repo.count_by_cycle(cycle_id)
        submitted = self.app_repo.count_by_cycle(cycle_id, ApplicationStatusEnum.SUBMITTED)
        finalized = self.app_repo.count_by_cycle(cycle_id, ApplicationStatusEnum.FINALIZED)
        scored = self.app_repo.count_by_cycle(cycle_id, ApplicationStatusEnum.SCORED)
        selected = self.app_repo.count_by_cycle(cycle_id, ApplicationStatusEnum.SELECTED)

        return {
            "cycle_id": cycle.cycle_id,
            "cycle_name": cycle.cycle_name,
            "phase": cycle.phase.value,
            "is_open": cycle.is_open,
            "max_seats": cycle.max_seats,
            "current_seats": cycle.current_seats,
            "selected_count": cycle.selected_count,
            "stats": {
                "total_applications": total_apps,
                "submitted": submitted,
                "finalized": finalized,
                "scored": scored,
                "selected": selected
            },
            "dates": {
                "start_date": cycle.start_date.isoformat(),
                "end_date": cycle.end_date.isoformat(),
                "result_date": cycle.result_date.isoformat(),
                "created_at": cycle.created_at.isoformat(),
                "closed_at": cycle.closed_at.isoformat() if cycle.closed_at else None
            }
        }
