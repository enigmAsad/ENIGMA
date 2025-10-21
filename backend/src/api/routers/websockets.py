"""WebSocket routes for real-time audio, nudges, and WebRTC signaling."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List
from datetime import datetime, timezone

from src.database.engine import get_db_context
from src.utils.logger import get_logger

logger = get_logger("api.websockets")

router = APIRouter(tags=["WebSockets"])


# ==============================================================================
# WebRTC Signaling Connection Manager
# ==============================================================================

class ConnectionManager:
    """Manages WebSocket connections for WebRTC signaling."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)

    async def broadcast(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    await connection.send_text(message)


manager = ConnectionManager()


# ==============================================================================
# Phase 2: Bias Monitoring - Nudge Connection Manager
# ==============================================================================

class NudgeConnectionManager:
    """Manages WebSocket connections for nudge delivery to admins."""

    def __init__(self):
        self.active_connections: Dict[int, Dict[str, WebSocket]] = {}  # {interview_id: {admin_id: websocket}}
        self.logger = get_logger("nudge_connection_manager")

    async def connect(self, websocket: WebSocket, interview_id: int, admin_id: str):
        await websocket.accept()
        if interview_id not in self.active_connections:
            self.active_connections[interview_id] = {}
        self.active_connections[interview_id][admin_id] = websocket
        self.logger.info(f"Admin {admin_id} connected to nudge stream for interview {interview_id}")

    def disconnect(self, interview_id: int, admin_id: str):
        if interview_id in self.active_connections:
            if admin_id in self.active_connections[interview_id]:
                del self.active_connections[interview_id][admin_id]
                self.logger.info(f"Admin {admin_id} disconnected from nudge stream for interview {interview_id}")
            if not self.active_connections[interview_id]:
                del self.active_connections[interview_id]

    async def send_nudge(self, interview_id: int, admin_id: str, nudge_data: dict):
        """Send a nudge to a specific admin."""
        if interview_id in self.active_connections:
            if admin_id in self.active_connections[interview_id]:
                websocket = self.active_connections[interview_id][admin_id]
                try:
                    await websocket.send_json(nudge_data)
                    self.logger.info(f"Sent nudge to admin {admin_id} in interview {interview_id}")
                except Exception as e:
                    self.logger.error(f"Failed to send nudge: {str(e)}")


nudge_manager = NudgeConnectionManager()


# ==============================================================================
# Phase 2: Audio Streaming for STT Processing
# ==============================================================================

@router.websocket("/ws/interview/{interview_id}/audio")
async def audio_stream_endpoint(
    websocket: WebSocket,
    interview_id: int,
    speaker: str = Query(...),  # 'admin' or 'student'
):
    """WebSocket endpoint for streaming audio chunks for STT processing.

    Flow:
    1. Client sends audio chunks (binary data)
    2. Server buffers chunks using AudioStreamManager
    3. When buffer full (10-15s), trigger STT transcription
    4. Store transcript and trigger bias analysis for admin speech
    5. Send acknowledgment back to client

    Args:
        interview_id: The interview ID
        speaker: 'admin' or 'student'
    """
    from src.services.stt_service import audio_stream_manager, STTService
    from src.services.bias_detection_service import BiasDetectionService
    from src.database.models import SpeakerEnum

    logger = get_logger("audio_stream")

    await websocket.accept()
    logger.info(f"Audio stream connected for interview {interview_id}, speaker: {speaker}")

    # Start audio stream
    audio_stream_manager.start_stream(interview_id)

    try:
        # Get database session
        with get_db_context() as db:
            stt_service = STTService(db)
            bias_service = BiasDetectionService(db)

            # Get interview and admin details
            from src.database.repositories.interview_repository import InterviewRepository
            interview_repo = InterviewRepository(db)
            interview = interview_repo.get_by_id(interview_id)

            if not interview:
                await websocket.send_json({"error": "Interview not found"})
                await websocket.close()
                return

            # Validate interview has started for student connections
            if speaker == "student" and interview.started_at is None:
                logger.warning(f"Student attempted to connect to interview {interview_id} before admin started it")
                await websocket.send_json({
                    "error": "Interview has not been started yet. Please wait for the interviewer to begin."
                })
                await websocket.close()
                return

            speaker_enum = SpeakerEnum.ADMIN if speaker == "admin" else SpeakerEnum.STUDENT

            while True:
                # Receive audio chunk
                audio_chunk = await websocket.receive_bytes()

                # Add to buffer
                result = audio_stream_manager.add_audio_chunk(
                    interview_id=interview_id,
                    speaker=speaker_enum,
                    audio_chunk=audio_chunk,
                )

                # If buffer is full, process it
                if result:
                    complete_chunk, start_time = result # Unpack the tuple
                    logger.info(f"Processing {len(complete_chunk)} bytes for {speaker}")

                    # Transcribe and store
                    transcript_id = await stt_service.process_and_store_chunk(
                        interview_id=interview_id,
                        speaker=speaker_enum,
                        audio_data=complete_chunk,
                        start_time=start_time, # Correct start_time is passed
                    )

                    if transcript_id:
                        # Get the transcript to access its text
                        transcript = stt_service.transcript_repo.get_by_id(transcript_id)

                        # Send acknowledgment with the transcribed text
                        await websocket.send_json({
                            "status": "transcribed",
                            "transcript_id": transcript_id,
                            "text": transcript.transcript_text if transcript else None,
                        })

                        # If speaker is admin, run bias detection
                        if speaker_enum == SpeakerEnum.ADMIN and transcript:
                            logger.info(f"Running bias analysis for transcript {transcript_id}")

                            # Get recent context
                            context_str = stt_service.get_recent_context(
                                interview_id=interview_id,
                                before_time=start_time,
                                context_count=5,
                            )

                            # Run bias analysis
                            analysis_result = await bias_service.analyze_transcript(
                                transcript_id=transcript_id,
                                interview_id=interview_id,
                                admin_id=interview.admin_id,
                                transcript_text=transcript.transcript_text,
                                conversation_context=[context_str] if context_str else None,
                            )

                            # If nudge was created, send it via WebSocket
                            if analysis_result.get("nudge_id"):
                                await nudge_manager.send_nudge(
                                    interview_id=interview_id,
                                    admin_id=interview.admin_id,
                                    nudge_data={
                                        "nudge_id": analysis_result["nudge_id"],
                                        "nudge_type": analysis_result["nudge_type"],
                                        "message": analysis_result["nudge_message"],
                                        "severity": analysis_result["severity"],
                                        "display_duration": 5 if analysis_result["nudge_type"] == "info" else 10,
                                    },
                                )

    except WebSocketDisconnect:
        logger.info(f"Audio stream disconnected for interview {interview_id}, speaker: {speaker}")
        audio_stream_manager.stop_stream(interview_id)
    except Exception as e:
        logger.error(f"Audio stream error: {str(e)}")
        audio_stream_manager.stop_stream(interview_id)
        await websocket.close()


# ==============================================================================
# Phase 2: Nudge Delivery Stream
# ==============================================================================

@router.websocket("/ws/interview/{interview_id}/nudges")
async def nudge_stream_endpoint(
    websocket: WebSocket,
    interview_id: int,
    admin_id: str = Query(...),
):
    """WebSocket endpoint for delivering real-time bias nudges to admin.

    Flow:
    1. Admin connects with their admin_id
    2. Server subscribes to nudge events for this interview
    3. When nudge created (by audio stream endpoint), send via WebSocket
    4. Wait for acknowledgment from client
    5. Update nudge.acknowledged in database

    Args:
        interview_id: The interview ID
        admin_id: The admin's ID
    """
    logger = get_logger("nudge_stream")

    await nudge_manager.connect(websocket, interview_id, admin_id)

    try:
        with get_db_context() as db:
            from src.database.repositories.bias_repository import NudgeRepository
            nudge_repo = NudgeRepository(db)

            while True:
                # Wait for acknowledgment from client
                data = await websocket.receive_json()

                if data.get("type") == "acknowledge":
                    nudge_id = data.get("nudge_id")
                    if nudge_id:
                        logger.info(f"Admin {admin_id} acknowledged nudge {nudge_id}")
                        nudge_repo.acknowledge_nudge(nudge_id)
                        db.commit()

                        # Send confirmation
                        await websocket.send_json({
                            "status": "acknowledged",
                            "nudge_id": nudge_id,
                        })

    except WebSocketDisconnect:
        logger.info(f"Nudge stream disconnected for admin {admin_id} in interview {interview_id}")
        nudge_manager.disconnect(interview_id, admin_id)
    except Exception as e:
        logger.error(f"Nudge stream error: {str(e)}")
        nudge_manager.disconnect(interview_id, admin_id)


# ==============================================================================
# WebRTC Signaling Endpoint (existing)
# ==============================================================================

@router.websocket("/ws/interview/{interview_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    interview_id: str,
    role: str = Query(default="student"),  # 'admin' or 'student'
):
    """WebSocket endpoint for WebRTC signaling (peer-to-peer connection setup).

    Students can only connect after the admin has started the interview.
    Admins can connect anytime to set up their connection.
    """
    # Validate interview start status for students
    if role == "student":
        with get_db_context() as db:
            from src.database.repositories.interview_repository import InterviewRepository
            interview_repo = InterviewRepository(db)
            interview = interview_repo.get_by_id(int(interview_id))

            if not interview:
                logger.warning(f"WebRTC connection attempt to non-existent interview {interview_id}")
                await websocket.close(code=1008, reason="Interview not found")
                return

            if interview.started_at is None:
                logger.warning(f"Student attempted WebRTC connection to interview {interview_id} before admin started it")
                await websocket.close(code=1008, reason="Interview has not been started yet")
                return

    await manager.connect(websocket, interview_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data, interview_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, interview_id)
