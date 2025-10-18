"""Interview repository for managing interviews."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from src.database.models import Interview, InterviewStatusEnum
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("interview_repository")


class InterviewRepository(BaseRepository[Interview]):
    """Repository for interview-related operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(Interview, db)

    def create_interview(
        self,
        application_id: str,
        student_id: str,
        admin_id: str,
        admission_cycle_id: str,
        interview_time: datetime,
        interview_link: str,
    ) -> Interview:
        """Create a new interview.

        Args:
            application_id: ID of the application
            student_id: ID of the student
            admin_id: ID of the admin (interviewer)
            admission_cycle_id: ID of the admission cycle
            interview_time: Time of the interview
            interview_link: Link to the interview meeting

        Returns:
            Interview: The created interview object
        """
        interview = Interview(
            application_id=application_id,
            student_id=student_id,
            admin_id=admin_id,
            admission_cycle_id=admission_cycle_id,
            interview_time=interview_time,
            interview_link=interview_link,
            status=InterviewStatusEnum.SCHEDULED,
        )
        return self.create(interview)

    def get_by_id(self, interview_id: int) -> Optional[Interview]:
        """Get an interview by its ID."""
        return super().get_by_id(interview_id)

    def get_by_application_id(self, application_id: str) -> Optional[Interview]:
        """Get an interview by application ID."""
        stmt = select(Interview).where(Interview.application_id == application_id)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_student_id(self, student_id: str, cycle_id: Optional[str] = None) -> List[Interview]:
        """Get all interviews for a student, optionally filtered by cycle.

        Args:
            student_id: The student's ID
            cycle_id: Optional admission cycle ID to filter by

        Returns:
            A list of interviews
        """
        stmt = select(Interview).where(Interview.student_id == student_id)
        if cycle_id:
            stmt = stmt.where(Interview.admission_cycle_id == cycle_id)
        stmt = stmt.order_by(Interview.interview_time.desc())
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_by_admin_id(self, admin_id: str, cycle_id: Optional[str] = None) -> List[Interview]:
        """Get all interviews for an admin, optionally filtered by cycle.

        Args:
            admin_id: The admin's ID
            cycle_id: Optional admission cycle ID to filter by

        Returns:
            A list of interviews
        """
        stmt = select(Interview).where(Interview.admin_id == admin_id)
        if cycle_id:
            stmt = stmt.where(Interview.admission_cycle_id == cycle_id)
        stmt = stmt.order_by(Interview.interview_time.desc())
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_by_cycle_id(self, cycle_id: str) -> List[Interview]:
        """Get all interviews for a given admission cycle.

        Args:
            cycle_id: The admission cycle ID

        Returns:
            A list of interviews
        """
        stmt = select(Interview).where(Interview.admission_cycle_id == cycle_id).order_by(Interview.interview_time.desc())
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def update_interview(self, interview_id: int, update_data: Dict[str, Any]) -> Optional[Interview]:
        """Update an interview.

        Args:
            interview_id: The ID of the interview to update
            update_data: A dictionary with the fields to update

        Returns:
            The updated interview object, or None if not found
        """
        update_data["updated_at"] = datetime.utcnow()
        return self.update(interview_id, update_data)
