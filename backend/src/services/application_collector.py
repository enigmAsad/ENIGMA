"""Application collector for intake and validation."""

from typing import Dict, Any, Optional, List
from datetime import datetime

from src.models.schemas import Application as PydanticApplication, ApplicationStatus
from src.database.models import Application as SQLAlchemyApplication
from src.database.repositories import ApplicationRepository, AdminRepository
from src.utils.logger import get_logger, AuditLogger
from sqlalchemy.orm import Session


logger = get_logger("application_collector")


class ApplicationCollector:
    """Service for collecting and validating applications."""

    def __init__(self, db: Session, audit_logger: Optional[AuditLogger] = None):
        """Initialize application collector.

        Args:
            db: Database session
            audit_logger: Optional AuditLogger instance
        """
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.admin_repo = AdminRepository(db)
        self.audit_logger = audit_logger

    def collect_application(self, application_data: Dict[str, Any]) -> SQLAlchemyApplication:
        """Collect and validate a new application.

        Args:
            application_data: Raw application data from form

        Returns:
            SQLAlchemyApplication: The created SQLAlchemy Application model instance.

        Raises:
            ValueError: If application data is invalid
        """
        logger.info(f"Collecting new application from {application_data.get('email', 'unknown')}")

        try:
            # Validate data with Pydantic model first
            pydantic_app = PydanticApplication(**application_data)

        except Exception as e:
            logger.error(f"Application validation failed: {e}")
            raise ValueError(f"Invalid application data: {e}")

        # Check for duplicate ID
        existing = self.app_repo.get_by_application_id(pydantic_app.application_id)
        if existing:
            logger.warning(f"Duplicate application ID detected: {pydantic_app.application_id}")
            import uuid
            pydantic_app.application_id = f"APP_{uuid.uuid4().hex[:8].upper()}"

        # Get active cycle ID for the application
        active_cycle = self.admin_repo.get_active_cycle()
        if not active_cycle:
            raise ValueError("No active admission cycle found")

        # Create SQLAlchemy model in database and get the returned instance
        db_application = self.app_repo.create_application(
            application_id=pydantic_app.application_id,
            admission_cycle_id=active_cycle.cycle_id,
            name=pydantic_app.name,
            email=pydantic_app.email,
            phone=pydantic_app.phone,
            address=pydantic_app.address,
            gpa=pydantic_app.gpa,
            test_scores=pydantic_app.test_scores,
            essay=pydantic_app.essay,
            achievements=pydantic_app.achievements
        )

        # Audit log
        if self.audit_logger:
            self.audit_logger.log_application_submitted(db_application.application_id)

        logger.info(f"Application collected successfully: {db_application.application_id}")

        return db_application

    def collect_batch(self, applications_data: List[Dict[str, Any]]) -> List[SQLAlchemyApplication]:
        """Collect multiple applications in batch.

        Args:
            applications_data: List of raw application data

        Returns:
            List[SQLAlchemyApplication]: List of collected applications
        """
        logger.info(f"Collecting batch of {len(applications_data)} applications")

        collected = []
        errors = []

        for i, app_data in enumerate(applications_data):
            try:
                application = self.collect_application(app_data)
                collected.append(application)
            except ValueError as e:
                logger.error(f"Failed to collect application {i}: {e}")
                errors.append((i, str(e)))

        logger.info(
            f"Batch collection complete: {len(collected)} successful, {len(errors)} failed"
        )

        if errors:
            logger.warning(f"Failed applications: {errors}")

        return collected

    def get_application(self, application_id: str) -> Optional[SQLAlchemyApplication]:
        """Retrieve an application by ID.

        Args:
            application_id: Application ID

        Returns:
            Optional[SQLAlchemyApplication]: Application if found
        """
        return self.app_repo.get_by_application_id(application_id)

    def update_status(
        self,
        application_id: str,
        new_status: ApplicationStatus
    ) -> Optional[SQLAlchemyApplication]:
        """Update application status.

        Note: This is a simplified implementation for MVP.
        In production, use proper update mechanism.

        Args:
            application_id: Application ID
            new_status: New status

        Returns:
            Optional[SQLAlchemyApplication]: Updated application
        """
        logger.info(f"Updating application {application_id} status to {new_status.value}")

        # Note: For MVP, we don't implement in-place CSV updates
        # Status is tracked through the pipeline state machine
        # This method is here for API completeness

        logger.warning("Status update not persisted in MVP (tracked via pipeline state)")

        return self.get_application(application_id)
