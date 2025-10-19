"""Repository for managing interview scores in the database."""

from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from src.database.models import InterviewScore
from src.models.schemas import InterviewScoreCreate


class InterviewScoreRepository:
    """Repository for interview score data operations."""

    def __init__(self, db: Session):
        """Initialize the repository with a database session."""
        self.db = db

    def create_score(
        self, interview_id: int, scored_by: str, score_data: InterviewScoreCreate
    ) -> InterviewScore:
        """Create a new interview score record.

        Args:
            interview_id: The ID of the interview being scored.
            scored_by: The admin_id of the user submitting the score.
            score_data: The Pydantic model with score data.

        Returns:
            The newly created InterviewScore object.
        """
        # Calculate final score as the average of the three sub-scores
        final_score = (
            score_data.communication_score
            + score_data.critical_thinking_score
            + score_data.motivation_score
        ) / 3.0

        db_score = InterviewScore(
            interview_id=interview_id,
            scored_by=scored_by,
            communication_score=score_data.communication_score,
            critical_thinking_score=score_data.critical_thinking_score,
            motivation_score=score_data.motivation_score,
            final_interview_score=final_score,
            notes=score_data.notes,
            scored_at=datetime.now(timezone.utc),
        )
        self.db.add(db_score)
        self.db.flush()  # Flush to get the ID without committing
        return db_score
