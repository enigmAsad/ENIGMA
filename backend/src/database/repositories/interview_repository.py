"""Interview repository for managing interviews."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from src.database.models import Interview, InterviewStatusEnum, InterviewScore
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

    def delete_interview(self, interview_id: int) -> bool:
        """Delete an interview by its ID.

        Args:
            interview_id: The ID of the interview to delete

        Returns:
            True if deletion was successful, False otherwise
        """
        interview = self.get_by_id(interview_id)
        if interview:
            self.db.delete(interview)
            return True
        return False

    def add_interview_score(
        self, 
        interview_id: int, 
        scorer_admin_id: str,
        scores: Dict[str, float],
        notes: Optional[str] = None
    ) -> InterviewScore:
        """Add a score to an interview.

        Args:
            interview_id: The ID of the interview
            scorer_admin_id: The ID of the admin who scored the interview
            scores: A dictionary of scores (e.g., communication, critical_thinking)
            notes: Optional notes from the scorer

        Returns:
            The created InterviewScore object
        """
        from src.database.models import InterviewScore

        # For now, final score is a simple average.
        # This can be replaced with a weighted average later.
        final_score = sum(scores.values()) / len(scores) if scores else 0.0

        interview_score = InterviewScore(
            interview_id=interview_id,
            scored_by=scorer_admin_id,
            communication_score=scores.get("communication", 0.0),
            critical_thinking_score=scores.get("critical_thinking", 0.0),
            motivation_score=scores.get("motivation", 0.0),
            final_interview_score=final_score,
            notes=notes
        )
        self.db.add(interview_score)
        self.db.flush()
        return interview_score

    def get_top_interview_performers(self, cycle_id: str, limit: int) -> List[InterviewScore]:
        """Get the top performing interviews for a cycle based on score."""
        from src.database.models import InterviewScore, Application

        stmt = (
            select(InterviewScore)
            .join(Interview, InterviewScore.interview_id == Interview.id)
            .join(Application, Interview.application_id == Application.application_id)
            .where(Application.admission_cycle_id == cycle_id)
            .order_by(InterviewScore.final_interview_score.desc())
            .limit(limit)
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())
