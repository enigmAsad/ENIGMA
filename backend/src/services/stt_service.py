"""Speech-to-Text service for real-time interview transcription."""

import asyncio

from typing import Optional, Dict, Any, Tuple

from datetime import datetime, timezone, timedelta

import io

import wave



from openai import AsyncOpenAI

from sqlalchemy.orm import Session



from src.config.settings import get_settings



settings = get_settings()

from src.database.repositories.transcript_repository import TranscriptRepository

from src.database.models import SpeakerEnum

from src.utils.logger import get_logger



# Added pydub imports

from pydub import AudioSegment

from pydub.exceptions import CouldntDecodeError



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

            audio_data: Raw 16-bit PCM audio bytes.

            language: Language code (default: "en")



        Returns:

            Dictionary with:

                - text: Transcribed text

                - confidence: Confidence score (0.0-1.0)

                - duration: Audio duration in seconds

        """

        try:

            # Wrap the raw PCM data in a WAV container in memory.

            # The frontend will send audio at 16kHz, 16-bit, mono.

            wav_file = io.BytesIO()

            with wave.open(wav_file, "wb") as wf:

                wf.setnchannels(1)

                wf.setsampwidth(2)

                wf.setframerate(16000)

                wf.writeframes(audio_data)

            

            # After writing, the BytesIO object's cursor is at the end.

            # We need to reset it to the beginning before reading it for the API call.

            wav_file.seek(0)

            wav_file.name = "audio.wav" # The API client needs a name



            # Call Whisper API

            logger.info(f"Sending {len(wav_file.getvalue())} bytes to Whisper API as WAV")

            response = await self.client.audio.transcriptions.create(

                model="whisper-1",

                file=wav_file, # Pass the BytesIO object directly

                language=language,

                response_format="verbose_json",

            )



            # Extract result

            transcript_text = response.text



            # Whisper doesn't provide confidence directly, use segment data if available

            confidence = 0.9  # Default high confidence

            if hasattr(response, "segments") and response.segments:

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

            audio_data: Raw PCM audio bytes.

            start_time: When this chunk started



        Returns:

            Transcript ID if successful, None otherwise

        """

        try:

            # Transcribe the audio

            result = await self.transcribe_audio_chunk(audio_data)



            # Calculate end time based on duration

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

        self.silence_threshold_dbfs = -40  # dBFS, might need tuning

        self.silence_trigger_seconds = 1.5  # seconds of silence to trigger transcription

        self.min_audio_seconds = 2.0 # seconds, minimum audio to send

        self.max_audio_seconds = 30.0 # seconds, hard limit to prevent infinitely long buffers

        self.bytes_per_second = 32000 # 16kHz, 16-bit mono audio

        logger.info(f"AudioStreamManager initialized with silence detection (threshold: {self.silence_threshold_dbfs}dBFS, trigger: {self.silence_trigger_seconds}s, min: {self.min_audio_seconds}s, max: {self.max_audio_seconds}s)")



    def start_stream(self, interview_id: int) -> None:

        """Start an audio stream for an interview.



        Args:

            interview_id: The interview ID

        """

        if interview_id in self.active_streams:

            logger.warning(f"Stream already exists for interview {interview_id}")

            return



        now = datetime.now(timezone.utc)

        self.active_streams[interview_id] = {

            "admin_buffer": bytearray(),

            "student_buffer": bytearray(),

            "admin_last_speech_time": now,

            "student_last_speech_time": now,

            "admin_buffer_start_time": now,

            "student_buffer_start_time": now,

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

    ) -> Optional[Tuple[bytes, datetime]]: # Changed return type

        """Add audio chunk to buffer and return full chunk if ready.



        Args:

            interview_id: The interview ID

            speaker: Who is speaking

            audio_chunk: Raw PCM audio data chunk



        Returns:

            Tuple of (complete audio chunk, start time) if buffer is full, None otherwise

        """

        # Backend Guard: Do not process audio from students.

        if speaker == SpeakerEnum.STUDENT:

            return None



        if interview_id not in self.active_streams:

            logger.warning(f"No active stream for interview {interview_id}")

            return None



        stream = self.active_streams[interview_id]

        buffer_key = f"{speaker.name.lower()}_buffer"

        last_speech_time_key = f"{speaker.name.lower()}_last_speech_time"

        buffer_start_time_key = f"{speaker.name.lower()}_buffer_start_time"



        # Add to buffer

        stream[buffer_key].extend(audio_chunk)



        # Check for speech in the current audio_chunk

        try:

            audio_segment = AudioSegment(

                data=audio_chunk,

                sample_width=2,

                frame_rate=16000,

                channels=1

            )

            if audio_segment.dBFS > self.silence_threshold_dbfs:

                stream[last_speech_time_key] = datetime.now(timezone.utc)

        except CouldntDecodeError:

            # This can happen with very short or malformed chunks, log and continue

            logger.debug(f"Could not decode audio chunk for dBFS check. Interview: {interview_id}, Speaker: {speaker}")

            pass

        except Exception as e:

            logger.error(f"Error checking dBFS for audio chunk: {e}. Interview: {interview_id}, Speaker: {speaker}")

            pass



        now = datetime.now(timezone.utc)

        time_since_last_speech = (now - stream[last_speech_time_key]).total_seconds()

        buffer_duration_seconds = len(stream[buffer_key]) / self.bytes_per_second



        # Conditions to trigger transcription:

        # 1. Sufficient silence detected AND minimum audio duration met

        # 2. Maximum audio duration reached (hard limit)

        should_transcribe = False

        if (time_since_last_speech > self.silence_trigger_seconds and buffer_duration_seconds >= self.min_audio_seconds):

            logger.debug(f"Silence trigger met for {speaker} in interview {interview_id}. Buffer duration: {buffer_duration_seconds:.2f}s, Time since last speech: {time_since_last_speech:.2f}s")

            should_transcribe = True

        elif buffer_duration_seconds >= self.max_audio_seconds:

            logger.debug(f"Max audio duration trigger met for {speaker} in interview {interview_id}. Buffer duration: {buffer_duration_seconds:.2f}s")

            should_transcribe = True



        if should_transcribe:

            complete_chunk = bytes(stream[buffer_key])

            chunk_start_time = stream[buffer_start_time_key]



            # Reset buffer and update start time for the next chunk

            stream[buffer_key] = bytearray()

            stream[buffer_start_time_key] = now

            stream[last_speech_time_key] = now # Reset last speech time as well



            logger.info(f"Returning {len(complete_chunk)} bytes for transcription (duration: {buffer_duration_seconds:.2f}s) for {speaker} in interview {interview_id}")

            return complete_chunk, chunk_start_time



        return None





# Global stream manager instance

audio_stream_manager = AudioStreamManager()


