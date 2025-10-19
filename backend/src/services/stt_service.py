"""Speech-to-Text service for real-time interview transcription."""

import asyncio
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import io
import wave  # Import wave module

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from src.config.settings import get_settings

settings = get_settings()
from src.database.repositories.transcript_repository import TranscriptRepository
from src.database.models import SpeakerEnum
from src.utils.logger import get_logger

logger = get_logger("stt_service")


class STTService:
    """Service for speech-to-text transcription using OpenAI Whisper."""

    def __init__(self, db: Session):
        """Initialize STT service.

        Args:
            db: Database session
        """
        self.db = db
        self.transcript_repo = TranscriptRepository(db)
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe_audio_chunk(
        self,
        audio_data: bytes,
        language: str = "en",
    ) -> Dict[str, Any]:
        """Transcribe an audio chunk using OpenAI Whisper API.

        Args:
            audio_data: Raw audio bytes (PCM format)
            language: Language code (default: "en")

        Returns:
            Dictionary with:
                - text: Transcribed text
                - confidence: Confidence score (0.0-1.0)
                - duration: Audio duration in seconds
        """
        try:
            # Convert raw PCM data to WAV format in memory
            # Assuming 48kHz, 16-bit mono audio from the browser
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, "wb") as wf:
                wf.setnchannels(1)  # Mono
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(48000)  # 48kHz sample rate
                wf.writeframes(audio_data)
            
            wav_data = wav_buffer.getvalue()

            # Create a file-like object from the WAV bytes
            audio_file = io.BytesIO(wav_data)
            audio_file.name = "audio.wav"  # Set filename to .wav

            # Call Whisper API
            logger.info(f"Sending {len(wav_data)} bytes to Whisper API as WAV")
            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="verbose_json",  # Get detailed response with timestamps
            )

            # Extract result
            transcript_text = response.text

            # Whisper doesn't provide confidence directly, use segment data if available
            confidence = 0.9  # Default high confidence
            if hasattr(response, "segments") and response.segments:
                # Average the "no_speech_prob" from segments as a proxy for confidence
                confidences = [1.0 - seg.get("no_speech_prob", 0.1) for seg in response.segments if isinstance(seg, dict)]
                if confidences:
                    confidence = sum(confidences) / len(confidences)

            duration = getattr(response, "duration", 0.0)

            logger.info(f"Transcribed: '{transcript_text[:50]}...' (confidence: {confidence:.2f})")

            return {
                "text": transcript_text,
                "confidence": confidence,
                "duration": duration,
            }

        except Exception as e:
            logger.error(f"STT transcription failed: {str(e)}")
            raise

    async def process_and_store_chunk(
        self,
        interview_id: int,
        speaker: SpeakerEnum,
        audio_data: bytes,
        start_time: datetime,
    ) -> Optional[int]:
        """Process audio chunk, transcribe it, and store in database.

        Args:
            interview_id: ID of the interview
            speaker: Who is speaking (admin/student)
            audio_data: Raw audio bytes
            start_time: When this chunk started

        Returns:
            Transcript ID if successful, None otherwise
        """
        try:
            # Transcribe the audio
            result = await self.transcribe_audio_chunk(audio_data)

            # Calculate end time based on duration
            from datetime import timedelta
            end_time = start_time + timedelta(seconds=result["duration"])

            # Store in database
            transcript = self.transcript_repo.create_transcript(
                interview_id=interview_id,
                speaker=speaker,
                transcript_text=result["text"],
                start_time=start_time,
                end_time=end_time,
                confidence_score=result["confidence"],
            )

            self.db.commit()
            logger.info(f"Stored transcript {transcript.id} for interview {interview_id}")

            return transcript.id

        except Exception as e:
            logger.error(f"Failed to process audio chunk: {str(e)}")
            self.db.rollback()
            return None

    def get_recent_context(
        self,
        interview_id: int,
        before_time: datetime,
        context_count: int = 5,
    ) -> str:
        """Get recent transcript context as a formatted string.

        Args:
            interview_id: The interview ID
            before_time: Get context before this time
            context_count: Number of previous chunks

        Returns:
            Formatted context string
        """
        transcripts = self.transcript_repo.get_recent_context(
            interview_id=interview_id,
            before_time=before_time,
            context_count=context_count,
        )

        # Reverse to get chronological order
        transcripts.reverse()

        context_lines = []
        for t in transcripts:
            speaker_label = "EVALUATOR" if t.speaker == SpeakerEnum.ADMIN else "APPLICANT"
            context_lines.append(f"{speaker_label}: {t.transcript_text}")

        return "\n".join(context_lines)


class AudioStreamManager:
    """Manages audio streaming sessions for multiple interviews."""

    def __init__(self):
        """Initialize audio stream manager."""
        self.active_streams: Dict[int, Dict[str, Any]] = {}
        self.buffer_duration = settings.stt_chunk_duration_seconds  # From config
        logger.info(f"AudioStreamManager initialized with {self.buffer_duration}s buffer duration")

    def start_stream(self, interview_id: int) -> None:
        """Start an audio stream for an interview.

        Args:
            interview_id: The interview ID
        """
        if interview_id in self.active_streams:
            logger.warning(f"Stream already exists for interview {interview_id}")
            return

        self.active_streams[interview_id] = {
            "admin_buffer": bytearray(),
            "student_buffer": bytearray(),
            "last_admin_chunk_time": datetime.now(timezone.utc),
            "last_student_chunk_time": datetime.now(timezone.utc),
        }
        logger.info(f"Started audio stream for interview {interview_id}")

    def stop_stream(self, interview_id: int) -> None:
        """Stop an audio stream.

        Args:
            interview_id: The interview ID
        """
        if interview_id in self.active_streams:
            del self.active_streams[interview_id]
            logger.info(f"Stopped audio stream for interview {interview_id}")

    def add_audio_chunk(
        self,
        interview_id: int,
        speaker: SpeakerEnum,
        audio_chunk: bytes,
    ) -> Optional[bytes]:
        """Add audio chunk to buffer and return full chunk if ready.

        Args:
            interview_id: The interview ID
            speaker: Who is speaking
            audio_chunk: Audio data chunk

        Returns:
            Complete audio chunk if buffer is full, None otherwise
        """
        # Backend Guard: Do not process audio from students.
        if speaker == SpeakerEnum.STUDENT:
            return None

        if interview_id not in self.active_streams:
            logger.warning(f"No active stream for interview {interview_id}")
            return None

        stream = self.active_streams[interview_id]
        buffer_key = f"{speaker.value}_buffer"
        time_key = f"last_{speaker.value}_chunk_time"

        # Add to buffer
        stream[buffer_key].extend(audio_chunk)

        # Check if buffer duration reached (approximate based on size)
        # Assuming ~16kbps for WebM/Opus audio
        expected_size = self.buffer_duration * 2000  # ~2KB per second

        if len(stream[buffer_key]) >= expected_size:
            # Return the buffered data and reset
            complete_chunk = bytes(stream[buffer_key])
            stream[buffer_key] = bytearray()
            stream[time_key] = datetime.now(timezone.utc)
            return complete_chunk

        return None

    def is_active(self, interview_id: int) -> bool:
        """Check if a stream is active.

        Args:
            interview_id: The interview ID

        Returns:
            True if stream is active
        """
        return interview_id in self.active_streams


# Global stream manager instance
audio_stream_manager = AudioStreamManager()
