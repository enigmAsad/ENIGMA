"""Transcript repository for managing live interview transcripts."""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from src.database.models import LiveTranscript, SpeakerEnum
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("transcript_repository")


class TranscriptRepository(BaseRepository[LiveTranscript]):
    """Repository for live transcript operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(LiveTranscript, db)

    def create_transcript(
        self,
        interview_id: int,
        speaker: SpeakerEnum,
        transcript_text: str,
        start_time: datetime,
        end_time: datetime,
        confidence_score: Optional[float] = None,
    ) -> LiveTranscript:
        """Create a new transcript chunk.

        Args:
            interview_id: ID of the interview
            speaker: Who is speaking (admin or student)
            transcript_text: The transcribed text
            start_time: When this chunk started
            end_time: When this chunk ended
            confidence_score: STT confidence (0.0-1.0)

        Returns:
            LiveTranscript: The created transcript object
        """
        transcript = LiveTranscript(
            interview_id=interview_id,
            speaker=speaker,
            transcript_text=transcript_text,
            start_time=start_time,
            end_time=end_time,
            confidence_score=confidence_score,
        )
        return self.create(transcript)

    def get_by_interview_id(
        self,
        interview_id: int,
        speaker: Optional[SpeakerEnum] = None,
        limit: Optional[int] = None,
    ) -> List[LiveTranscript]:
        """Get all transcripts for an interview.

        Args:
            interview_id: The interview ID
            speaker: Optional filter by speaker
            limit: Optional limit on number of results

        Returns:
            List of transcripts ordered by start_time
        """
        stmt = select(LiveTranscript).where(LiveTranscript.interview_id == interview_id)

        if speaker:
            stmt = stmt.where(LiveTranscript.speaker == speaker)

        stmt = stmt.order_by(LiveTranscript.start_time.asc())

        if limit:
            stmt = stmt.limit(limit)

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_recent_context(
        self,
        interview_id: int,
        before_time: datetime,
        context_count: int = 5,
    ) -> List[LiveTranscript]:
        """Get recent transcript chunks for context.

        Args:
            interview_id: The interview ID
            before_time: Get chunks before this time
            context_count: Number of previous chunks to retrieve

        Returns:
            List of recent transcripts (most recent first)
        """
        stmt = (
            select(LiveTranscript)
            .where(LiveTranscript.interview_id == interview_id)
            .where(LiveTranscript.start_time < before_time)
            .order_by(desc(LiveTranscript.start_time))
            .limit(context_count)
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_admin_transcripts(
        self,
        interview_id: int,
        limit: Optional[int] = None,
    ) -> List[LiveTranscript]:
        """Get all admin (evaluator) transcripts for an interview.

        Args:
            interview_id: The interview ID
            limit: Optional limit on results

        Returns:
            List of admin transcripts
        """
        return self.get_by_interview_id(
            interview_id=interview_id,
            speaker=SpeakerEnum.ADMIN,
            limit=limit,
        )

    def get_transcript_count(self, interview_id: int) -> int:
        """Get total count of transcript chunks for an interview.

        Args:
            interview_id: The interview ID

        Returns:
            Count of transcript chunks
        """
        stmt = select(LiveTranscript).where(LiveTranscript.interview_id == interview_id)
        result = self.db.execute(stmt)
        return len(list(result.scalars().all()))
