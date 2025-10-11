"""Application repository for managing applications and related data."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, update, func

from src.database.models import (
    Application, AnonymizedApplication, IdentityMapping,
    DeterministicMetrics, WorkerResult, JudgeResult, FinalScore,
    ApplicationStatusEnum
)
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("application_repository")


class ApplicationRepository(BaseRepository[Application]):
    """Repository for application-related operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(Application, db)

    def create_application(
        self,
        application_id: str,
        admission_cycle_id: str,
        name: str,
        email: str,
        gpa: float,
        test_scores: Dict[str, float],
        essay: str,
        achievements: str,
        phone: Optional[str] = None,
        address: Optional[str] = None
    ) -> Application:
        """Create a new application.

        Args:
            application_id: Unique application ID
            admission_cycle_id: ID of admission cycle
            name: Applicant name
            email: Applicant email
            gpa: GPA value
            test_scores: Test scores dictionary
            essay: Application essay
            achievements: Achievements text
            phone: Optional phone number
            address: Optional address

        Returns:
            Application: Created application
        """
        application = Application(
            application_id=application_id,
            admission_cycle_id=admission_cycle_id,
            name=name,
            email=email,
            phone=phone,
            address=address,
            gpa=gpa,
            test_scores=test_scores,
            essay=essay,
            achievements=achievements,
            status=ApplicationStatusEnum.SUBMITTED
        )
        return self.create(application)

    def get_by_application_id(self, application_id: str) -> Optional[Application]:
        """Get application by application ID."""
        return self.get_by_id(application_id, "application_id")

    def get_by_email(self, email: str) -> Optional[Application]:
        """Get application by email."""
        stmt = select(Application).where(Application.email == email)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_cycle(
        self,
        cycle_id: str,
        status: Optional[ApplicationStatusEnum] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Application]:
        """Get applications for a specific admission cycle.

        Args:
            cycle_id: Admission cycle ID
            status: Optional status filter
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            List[Application]: List of applications
        """
        stmt = select(Application).where(
            Application.admission_cycle_id == cycle_id
        )

        if status:
            stmt = stmt.where(Application.status == status)

        stmt = stmt.offset(skip).limit(limit).order_by(Application.timestamp.desc())

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def update_status(self, application_id: str, status: ApplicationStatusEnum) -> Optional[Application]:
        """Update application status."""
        return self.update(
            application_id,
            {
                "status": status,
                "updated_at": datetime.utcnow()
            },
            "application_id"
        )

    def count_by_cycle(
        self,
        cycle_id: str,
        status: Optional[ApplicationStatusEnum] = None
    ) -> int:
        """Count applications in a cycle.

        Args:
            cycle_id: Admission cycle ID
            status: Optional status filter

        Returns:
            int: Count of applications
        """
        stmt = select(func.count()).select_from(Application).where(
            Application.admission_cycle_id == cycle_id
        )

        if status:
            stmt = stmt.where(Application.status == status)

        result = self.db.execute(stmt)
        return result.scalar_one()

    def finalize_applications(self, cycle_id: str) -> int:
        """Mark all submitted applications as finalized.

        Args:
            cycle_id: Admission cycle ID

        Returns:
            int: Number of applications finalized
        """
        stmt = (
            update(Application)
            .where(
                Application.admission_cycle_id == cycle_id,
                Application.status == ApplicationStatusEnum.SUBMITTED
            )
            .values(
                status=ApplicationStatusEnum.FINALIZED,
                updated_at=datetime.utcnow()
            )
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    # Anonymized Application Operations

    def create_anonymized(
        self,
        anonymized_id: str,
        application_id: str,
        gpa: float,
        test_scores: Dict[str, float],
        essay_scrubbed: str,
        achievements_scrubbed: str
    ) -> AnonymizedApplication:
        """Create anonymized application.

        Args:
            anonymized_id: Unique anonymized ID
            application_id: Original application ID
            gpa: GPA value
            test_scores: Test scores
            essay_scrubbed: PII-removed essay
            achievements_scrubbed: PII-removed achievements

        Returns:
            AnonymizedApplication: Created anonymized application
        """
        anonymized = AnonymizedApplication(
            anonymized_id=anonymized_id,
            application_id=application_id,
            gpa=gpa,
            test_scores=test_scores,
            essay_scrubbed=essay_scrubbed,
            achievements_scrubbed=achievements_scrubbed
        )
        self.db.add(anonymized)
        self.db.flush()
        self.db.refresh(anonymized)
        return anonymized

    def get_anonymized_by_id(self, anonymized_id: str) -> Optional[AnonymizedApplication]:
        """Get anonymized application by ID."""
        stmt = select(AnonymizedApplication).where(
            AnonymizedApplication.anonymized_id == anonymized_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_anonymized_by_application_id(self, application_id: str) -> Optional[AnonymizedApplication]:
        """Get anonymized application by original application ID."""
        stmt = select(AnonymizedApplication).where(
            AnonymizedApplication.application_id == application_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    # Identity Mapping Operations

    def create_identity_mapping(
        self,
        anonymized_id: str,
        application_id: str,
        encrypted_pii: str
    ) -> IdentityMapping:
        """Create identity mapping with encrypted PII.

        Args:
            anonymized_id: Anonymized ID
            application_id: Original application ID
            encrypted_pii: Fernet-encrypted PII JSON

        Returns:
            IdentityMapping: Created mapping
        """
        mapping = IdentityMapping(
            anonymized_id=anonymized_id,
            application_id=application_id,
            encrypted_pii=encrypted_pii
        )
        self.db.add(mapping)
        self.db.flush()
        self.db.refresh(mapping)
        return mapping

    def get_identity_mapping(self, anonymized_id: str) -> Optional[IdentityMapping]:
        """Get identity mapping by anonymized ID."""
        stmt = select(IdentityMapping).where(
            IdentityMapping.anonymized_id == anonymized_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    # Deterministic Metrics Operations

    def create_deterministic_metrics(
        self,
        application_id: str,
        test_average: float,
        academic_score_computed: float,
        percentile_rank: Optional[float] = None
    ) -> DeterministicMetrics:
        """Create deterministic metrics for application.

        Args:
            application_id: Application ID
            test_average: Average of test scores
            academic_score_computed: Computed academic score (0-100)
            percentile_rank: Optional percentile rank

        Returns:
            DeterministicMetrics: Created metrics
        """
        metrics = DeterministicMetrics(
            application_id=application_id,
            test_average=test_average,
            academic_score_computed=academic_score_computed,
            percentile_rank=percentile_rank
        )
        self.db.add(metrics)
        self.db.flush()
        self.db.refresh(metrics)
        return metrics

    def get_deterministic_metrics(self, application_id: str) -> Optional[DeterministicMetrics]:
        """Get deterministic metrics for application."""
        stmt = select(DeterministicMetrics).where(
            DeterministicMetrics.application_id == application_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def compute_percentile_ranks(self, cycle_id: str) -> int:
        """Compute and update percentile ranks for all applications in a cycle.

        Args:
            cycle_id: Admission cycle ID

        Returns:
            int: Number of records updated
        """
        # This would typically involve a more complex query using window functions
        # For now, this is a placeholder
        logger.info(f"Computing percentile ranks for cycle {cycle_id}")
        # Implementation would go here
        return 0

    # Worker and Judge Results

    def create_worker_result(self, worker_result: WorkerResult) -> WorkerResult:
        """Create worker result."""
        self.db.add(worker_result)
        self.db.flush()
        self.db.refresh(worker_result)
        return worker_result

    def get_worker_results(self, anonymized_id: str) -> List[WorkerResult]:
        """Get all worker results for an anonymized application."""
        stmt = select(WorkerResult).where(
            WorkerResult.anonymized_id == anonymized_id
        ).order_by(WorkerResult.attempt_number)
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def create_judge_result(self, judge_result: JudgeResult) -> JudgeResult:
        """Create judge result."""
        self.db.add(judge_result)
        self.db.flush()
        self.db.refresh(judge_result)
        return judge_result

    def get_judge_result(self, worker_result_id: str) -> Optional[JudgeResult]:
        """Get judge result for a worker result."""
        stmt = select(JudgeResult).where(
            JudgeResult.worker_result_id == worker_result_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    # Final Score Operations

    def create_final_score(self, final_score: FinalScore) -> FinalScore:
        """Create final score."""
        self.db.add(final_score)
        self.db.flush()
        self.db.refresh(final_score)
        return final_score

    def get_final_score(self, anonymized_id: str) -> Optional[FinalScore]:
        """Get final score by anonymized ID."""
        stmt = select(FinalScore).where(
            FinalScore.anonymized_id == anonymized_id
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def update_final_score_status(
        self,
        anonymized_id: str,
        status: ApplicationStatusEnum
    ) -> Optional[FinalScore]:
        """Update final score status (for selection)."""
        stmt = (
            update(FinalScore)
            .where(FinalScore.anonymized_id == anonymized_id)
            .values(status=status)
            .returning(FinalScore)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def get_top_scores(
        self,
        cycle_id: str,
        limit: int,
        min_score: Optional[float] = None
    ) -> List[FinalScore]:
        """Get top N final scores for a cycle.

        Args:
            cycle_id: Admission cycle ID
            limit: Number of top scores to return
            min_score: Optional minimum score threshold

        Returns:
            List[FinalScore]: Top scores ordered by final_score desc
        """
        # Join with anonymized -> application to filter by cycle
        stmt = (
            select(FinalScore)
            .join(AnonymizedApplication, FinalScore.anonymized_id == AnonymizedApplication.anonymized_id)
            .join(Application, AnonymizedApplication.application_id == Application.application_id)
            .where(Application.admission_cycle_id == cycle_id)
            .order_by(FinalScore.final_score.desc())
            .limit(limit)
        )

        if min_score is not None:
            stmt = stmt.where(FinalScore.final_score >= min_score)

        result = self.db.execute(stmt)
        return list(result.scalars().all())
