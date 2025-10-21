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

from src.database.repositories import AdminRepository, ApplicationRepository, InterviewRepository
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
        self.interview_repo = InterviewRepository(db)

    def freeze_cycle(self, cycle_id: str, closed_by: str) -> AdmissionCycle:
        """Transition from SUBMISSION to FROZEN phase.

        Phase 1 → Phase 2: Data Freeze

        Actions:
        - Close submissions (is_open = False)
        - Mark all submitted applications as finalized
        - Create database snapshot (recommended in production)

        Args:
            cycle_id: Cycle ID to freeze
            closed_by: Admin ID who is freezing the cycle

        Returns:
            AdmissionCycle: Updated cycle

        Raises:
            PhaseTransitionError: If transition is invalid
        """
        logger.info(f"Freezing cycle {cycle_id} by admin {closed_by}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.SUBMISSION:
            raise PhaseTransitionError(
                f"Can only freeze from SUBMISSION phase, currently in {cycle.phase.value}"
            )

        # Close cycle with actual admin ID
        cycle = self.admin_repo.close_cycle(cycle_id, closed_by)

        # Finalize all submitted applications
        finalized_count = self.app_repo.finalize_applications(cycle_id)
        logger.info(f"Finalized {finalized_count} applications")

        # Update phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.FROZEN)

        self.db.commit()

        logger.info(f"Cycle {cycle_id} frozen successfully")
        return cycle

    def start_preprocessing(self, cycle_id: str) -> AdmissionCycle:
        """Transition from FROZEN to PREPROCESSING phase.

        Phase 2 → Phase 3: Identity Scrubbing + Merit Pre-Processing

        ⭐ CRITICAL PHASE: This is where PII removal happens

        Actions:
        1. Scrub identity for all finalized applications
           - Remove PII from essays and achievements
           - Create anonymized_applications records
           - Create encrypted identity_mapping records
        2. Compute deterministic metrics
           - Calculate test averages, academic scores
           - Store in deterministic_metrics table
        3. Mark applications as BATCH_READY for export

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle

        Raises:
            PhaseTransitionError: If transition is invalid
        """
        logger.info(f"Starting preprocessing (scrubbing + metrics) for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.FROZEN:
            raise PhaseTransitionError(
                f"Can only preprocess from FROZEN phase, currently in {cycle.phase.value}"
            )

        # Update phase to PREPROCESSING
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.PREPROCESSING)

        # Get all finalized applications
        applications = self.app_repo.get_by_cycle(
            cycle_id,
            status=ApplicationStatusEnum.FINALIZED,
            limit=100000
        )

        if not applications:
            raise PhaseTransitionError(f"No finalized applications found for cycle {cycle_id}")

        logger.info(f"Processing {len(applications)} finalized applications")

        # Import identity scrubber
        from src.services.identity_scrubber import IdentityScrubber
        scrubber = IdentityScrubber(self.db)

        scrubbed_count = 0
        metrics_count = 0
        failed_count = 0
        ready_application_ids: list[str] = []

        # Process each application: SCRUB → COMPUTE METRICS
        for app in applications:
            try:
                # STEP 1: SCRUB IDENTITY (creates anonymized_applications + identity_mapping)
                existing_anon = self.app_repo.get_anonymized_by_application_id(app.application_id)
                if not existing_anon:
                    anonymized = scrubber.scrub_application(app.application_id)
                    scrubbed_count += 1
                    logger.debug(f"Scrubbed {app.application_id} → {anonymized.anonymized_id}")
                else:
                    anonymized = existing_anon
                    logger.debug(f"Application {app.application_id} already scrubbed")

                # STEP 2: COMPUTE DETERMINISTIC METRICS
                existing_metrics = self.app_repo.get_deterministic_metrics(app.application_id)
                if not existing_metrics:
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
                    metrics_count += 1
                else:
                    logger.debug(f"Metrics already computed for {app.application_id}")

                # Mark for BATCH_READY transition
                if anonymized:
                    ready_application_ids.append(app.application_id)

            except Exception as e:
                logger.error(f"Failed to process {app.application_id}: {e}")
                failed_count += 1
                continue

        # TODO: Compute percentile ranks
        # self.app_repo.compute_percentile_ranks(cycle_id)

        # STEP 3: Update application statuses to BATCH_READY (ready for Phase 4 export)
        batch_ready_count = 0
        if ready_application_ids:
            from sqlalchemy import update
            stmt = (
                update(Application)
                .where(
                    Application.application_id.in_(ready_application_ids)
                )
                .values(status=ApplicationStatusEnum.BATCH_READY)
            )
            result = self.db.execute(stmt)
            batch_ready_count = result.rowcount

        self.db.commit()

        logger.info(
            f"Preprocessing complete for cycle {cycle_id}: "
            f"{scrubbed_count} scrubbed, {metrics_count} metrics computed, "
            f"{batch_ready_count} marked BATCH_READY, {failed_count} failed"
        )
        return cycle

    def start_batch_prep(self, cycle_id: str) -> AdmissionCycle:
        """Transition from PREPROCESSING to BATCH_PREP phase.

        Phase 3 → Phase 4: Batch Preparation

        Actions:
        - Verify applications are BATCH_READY (already set by preprocessing)
        - Update cycle phase to BATCH_PREP
        - Ready for JSONL export

        Args:
            cycle_id: Cycle ID

        Returns:
            AdmissionCycle: Updated cycle

        Raises:
            PhaseTransitionError: If no applications are BATCH_READY
        """
        logger.info(f"Starting batch prep for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.PREPROCESSING:
            raise PhaseTransitionError(
                f"Can only start batch prep from PREPROCESSING phase, currently in {cycle.phase.value}"
            )

        # Verify applications are BATCH_READY (set by preprocessing phase)
        batch_ready_count = self.app_repo.count_by_cycle(
            cycle_id,
            status=ApplicationStatusEnum.BATCH_READY
        )

        if batch_ready_count == 0:
            raise PhaseTransitionError(
                f"No BATCH_READY applications found for cycle {cycle_id}. "
                "Preprocessing may have failed."
            )

        # Update cycle phase to BATCH_PREP
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.BATCH_PREP)

        self.db.commit()

        logger.info(
            f"Batch prep phase started for cycle {cycle_id}: "
            f"{batch_ready_count} applications ready for export"
        )
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

        if cycle.phase not in {
            AdmissionPhaseEnum.BATCH_PREP,
            AdmissionPhaseEnum.PROCESSING,
            AdmissionPhaseEnum.SCORED,
        }:
            raise PhaseTransitionError(
                f"Can only start processing from BATCH_PREP or PROCESSING phases"
            )

        if cycle.phase == AdmissionPhaseEnum.SCORED:
            logger.info(
                f"Cycle {cycle_id} already scored; skipping start_processing"
            )
            return cycle

        if cycle.phase == AdmissionPhaseEnum.PROCESSING:
            logger.info(
                f"Cycle {cycle_id} already in PROCESSING phase; refreshing application statuses"
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

        # Update phase if we were not already processing
        if cycle.phase != AdmissionPhaseEnum.PROCESSING:
            cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.PROCESSING)
            self.db.commit()
            logger.info(f"Cycle {cycle_id} now in PROCESSING phase")
        else:
            self.db.commit()
            logger.info(f"Cycle {cycle_id} remains in PROCESSING phase")

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

        Phase 6 → Phase 7: Top-K Shortlisting for Interviews

        Actions:
        - Select top 2k applicants based on final_score for interviews.
        - Update application status to SHORTLISTED.
        - Create selection log.
        - **Update cycle phase to SELECTION.**

        Args:
            cycle_id: Cycle ID
            executed_by: Admin ID
            selection_strategy: Selection strategy (default: "top_k")

        Returns:
            Dict[str, Any]: Selection results
        """
        logger.info(f"Performing shortlisting for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        if cycle.phase != AdmissionPhaseEnum.SCORED:
            raise PhaseTransitionError(
                f"Can only perform selection from SCORED phase"
            )

        # Get top 2k final scores for shortlisting
        max_seats = cycle.max_seats
        shortlist_count = max_seats * 2
        top_scores = self.app_repo.get_top_scores(cycle_id, limit=shortlist_count)

        if not top_scores:
            raise PhaseTransitionError("No scored applications found")

        # Mark top applicants as SHORTLISTED
        shortlisted_actual_count = 0
        cutoff_score = None
        shortlisted_anonymized_ids = []

        for score in top_scores:
            self.app_repo.update_final_score_status(
                score.anonymized_id,
                ApplicationStatusEnum.SHORTLISTED
            )
            shortlisted_anonymized_ids.append(score.anonymized_id)
            shortlisted_actual_count += 1
            cutoff_score = score.final_score

        # Mark remaining as NOT_SELECTED
        from sqlalchemy import update
        from src.database.models import FinalScore, AnonymizedApplication

        # Get all scored but not shortlisted
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

        # Update application statuses to match FinalScore statuses
        # Update SHORTLISTED applications
        if shortlisted_anonymized_ids:
            shortlisted_apps_stmt = (
                update(Application)
                .where(
                    Application.admission_cycle_id == cycle_id,
                    Application.application_id.in_(
                        select(AnonymizedApplication.application_id)
                        .where(AnonymizedApplication.anonymized_id.in_(shortlisted_anonymized_ids))
                    )
                )
                .values(status=ApplicationStatusEnum.SHORTLISTED)
            )
            self.db.execute(shortlisted_apps_stmt)
            logger.info(f"Updated {len(shortlisted_anonymized_ids)} applications to SHORTLISTED status")

        # Update NOT_SELECTED applications
        not_selected_apps_stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status == ApplicationStatusEnum.SCORED,
                Application.application_id.in_(
                    select(AnonymizedApplication.application_id)
                    .join(FinalScore, AnonymizedApplication.anonymized_id == FinalScore.anonymized_id)
                    .where(FinalScore.status == ApplicationStatusEnum.NOT_SELECTED)
                )
            )
            .values(status=ApplicationStatusEnum.NOT_SELECTED)
        )
        not_selected_apps_result = self.db.execute(not_selected_apps_stmt)
        logger.info(f"Updated {not_selected_apps_result.rowcount} applications to NOT_SELECTED status")

        # Update cycle selected_count with the number of shortlisted applicants
        self.admin_repo.update_selected_count(cycle_id, shortlisted_actual_count)

        # Create selection log
        selection_criteria = {
            "strategy": selection_strategy,
            "final_selection_seats": max_seats,
            "interview_shortlist_target": shortlist_count,
            "interview_shortlist_actual": shortlisted_actual_count,
            "not_selected_count": not_selected_count,
            "cutoff_score": cutoff_score
        }

        self.admin_repo.create_selection_log(
            admission_cycle_id=cycle_id,
            selected_count=shortlisted_actual_count,
            selection_criteria=selection_criteria,
            cutoff_score=cutoff_score or 0.0,
            executed_by=executed_by
        )

        # **FIX**: Transition cycle to SELECTION phase
        cycle = self.admin_repo.update_cycle_phase(cycle_id, AdmissionPhaseEnum.SELECTION)

        self.db.commit()

        logger.info(
            f"Shortlisting complete: {shortlisted_actual_count} shortlisted, {not_selected_count} not selected. Cycle moved to SELECTION phase."
        )

        return {
            "shortlisted_count": shortlisted_actual_count,
            "not_selected_count": not_selected_count,
            "cutoff_score": cutoff_score,
            "selection_criteria": selection_criteria
        }

    def perform_final_selection(
        self,
        cycle_id: str,
        executed_by: str,
        selection_strategy: str = "top_k_interview"
    ) -> Dict[str, Any]:
        """
        Perform final selection after interviews.

        Takes SHORTLISTED applicants and moves them to SELECTED or NOT_SELECTED
        based on interview performance.

        Args:
            cycle_id: Cycle ID
            executed_by: Admin ID
            selection_strategy: Selection strategy

        Returns:
            Dict[str, Any]: Final selection results
        """
        logger.info(f"Performing final selection for cycle {cycle_id}")

        cycle = self.admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise PhaseTransitionError(f"Cycle {cycle_id} not found")

        # **FIX**: This action should run from the SELECTION phase, after interviews are done.
        if cycle.phase != AdmissionPhaseEnum.SELECTION:
            raise PhaseTransitionError(
                f"Can only perform final selection from SELECTION phase, currently in {cycle.phase.value}"
            )

        # Get the final 'k' number of seats
        max_seats = cycle.max_seats

        # **FIX**: Use the correct repository method to get top performers
        top_performers = self.interview_repo.get_top_interview_performers(cycle_id, limit=max_seats)

        if not top_performers:
            raise PhaseTransitionError("No scored interviews found for this cycle.")

        # Extract the application_ids of the winners
        selected_app_ids = set()
        for score in top_performers:
            # The relationship is InterviewScore -> Interview -> Application
            if score.interview and score.interview.application_id:
                selected_app_ids.add(score.interview.application_id)

        # Get all applications that were shortlisted for this cycle
        shortlisted_apps = self.app_repo.get_by_cycle(cycle_id, status=ApplicationStatusEnum.SHORTLISTED)
        shortlisted_app_ids = {app.application_id for app in shortlisted_apps}

        # Determine who was not selected from the shortlisted group
        not_selected_app_ids = list(shortlisted_app_ids - selected_app_ids)
        final_selected_app_ids = list(selected_app_ids)

        # Update statuses in FinalScore and Application tables
        if final_selected_app_ids:
            self.app_repo.update_application_status_by_ids(final_selected_app_ids, ApplicationStatusEnum.SELECTED)
            self.app_repo.update_final_score_status_by_app_ids(final_selected_app_ids, ApplicationStatusEnum.SELECTED)
            logger.info(f"Marked {len(final_selected_app_ids)} applicants as SELECTED.")

        if not_selected_app_ids:
            self.app_repo.update_application_status_by_ids(not_selected_app_ids, ApplicationStatusEnum.NOT_SELECTED)
            self.app_repo.update_final_score_status_by_app_ids(not_selected_app_ids, ApplicationStatusEnum.NOT_SELECTED)
            logger.info(f"Marked {len(not_selected_app_ids)} shortlisted applicants as NOT_SELECTED.")

        # Create a new selection log for this phase
        final_selection_criteria = {
            "strategy": selection_strategy,
            "final_seats_target": max_seats,
            "final_seats_actual": len(final_selected_app_ids),
            "not_selected_count": len(not_selected_app_ids),
        }

        self.admin_repo.create_selection_log(
            admission_cycle_id=cycle_id,
            selected_count=len(final_selected_app_ids),
            selection_criteria=final_selection_criteria,
            cutoff_score=0,  # Cutoff score is based on interview scores, harder to represent as a single number
            executed_by=executed_by
        )

        # The phase remains SELECTION. The next step is for the admin to PUBLISH.
        self.db.commit()

        logger.info(
            f"Final selection complete: {len(final_selected_app_ids)} selected, {len(not_selected_app_ids)} not selected"
        )

        return {
            "selected_count": len(final_selected_app_ids),
            "not_selected_count": len(not_selected_app_ids),
            "selection_criteria": final_selection_criteria
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
        from src.database.models import FinalScore, AnonymizedApplication

        # Update Application table
        app_stmt = (
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
        self.db.execute(app_stmt)



        # Refresh hash for all published scores
        select_stmt = (
            select(FinalScore)
            .where(
                FinalScore.anonymized_id.in_(
                    select(AnonymizedApplication.anonymized_id)
                    .join(Application, AnonymizedApplication.application_id == Application.application_id)
                    .where(Application.admission_cycle_id == cycle_id)
                )
            )
        )
        published_scores = list(self.db.execute(select_stmt).scalars().all())

        if published_scores:
            from src.database.repositories import AuditRepository
            from src.services.hash_chain import HashChainGenerator
            audit_repo = AuditRepository(self.db)
            hash_chain = HashChainGenerator(self.db, audit_repo=audit_repo)
            for score in published_scores:
                new_hash = hash_chain.create_phase1_hash(score)
                score.hash = new_hash

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
