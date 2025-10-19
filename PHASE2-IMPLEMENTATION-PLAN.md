# Phase 2 Bias Monitoring - Complete Implementation Plan

**Created:** 2025-10-19
**Status:** Implementation Ready
**Scope:** Complete bias monitoring from backend to frontend

---

## Executive Summary

### Current Status (After Analysis)

#### ✅ COMPLETE - Backend Services (80%)
- [x] Database schema (6 tables) with Alembic migration
- [x] Pydantic models and SQLAlchemy ORM
- [x] **STTService** - OpenAI Whisper integration with audio buffering
- [x] **BiasDetectionService** - LangGraph workflow wrapper
- [x] **BiasMonitoringWorkflow** - Complete LangGraph state machine
- [x] **NudgeService** - Graduated response with strike tracking
- [x] **All Repositories** - TranscriptRepo, BiasAnalysisRepo, NudgeRepo, BiasFlagRepo, AdminBiasHistoryRepo, DriftMetricsRepo

#### ❌ MISSING - Backend Integration (20%)
- [ ] WebSocket endpoint `/ws/interview/{id}/audio` for streaming
- [ ] WebSocket endpoint `/ws/interview/{id}/nudges` for alerts
- [ ] Interview coordinator to orchestrate STT → Bias → Nudge pipeline
- [ ] API endpoints for bias dashboard (`/admin/bias/*`)

#### ❌ MISSING - Frontend (100%)
- [ ] `NudgeOverlay.tsx` component for real-time alerts
- [ ] `/admin/bias/page.tsx` dashboard
- [ ] WebSocket client integration in interview room
- [ ] Audio capture and streaming from MediaStream
- [ ] API client methods for bias monitoring

---

## Implementation Phases

### Phase 1: Backend WebSocket Infrastructure (2-3 hours)

#### Task 1.1: Create Audio Streaming WebSocket Endpoint
**File:** `backend/api.py`

```python
@app.websocket("/ws/interview/{interview_id}/audio")
async def audio_stream_endpoint(
    websocket: WebSocket,
    interview_id: int,
    db: Session = Depends(get_db),
):
    """WebSocket endpoint for streaming audio chunks for STT processing.

    Flow:
    1. Client sends audio chunks (binary data)
    2. Server buffers chunks using AudioStreamManager
    3. When buffer full (10-15s), trigger STT transcription
    4. Store transcript and trigger bias analysis
    5. Send acknowledgment back to client
    """
```

**Implementation:**
- Accept WebSocket connection
- Use existing `AudioStreamManager` from `stt_service.py`
- Buffer audio chunks per speaker (admin/student)
- When buffer full, call `STTService.process_and_store_chunk()`
- Trigger bias analysis for admin transcripts only
- Handle errors and connection cleanup

#### Task 1.2: Create Nudge Delivery WebSocket Endpoint
**File:** `backend/api.py`

```python
@app.websocket("/ws/interview/{interview_id}/nudges")
async def nudge_stream_endpoint(
    websocket: WebSocket,
    interview_id: int,
    admin_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """WebSocket endpoint for delivering real-time bias nudges to admin.

    Flow:
    1. Admin connects with their admin_id
    2. Server subscribes to nudge events for this interview
    3. When nudge created, send via WebSocket
    4. Wait for acknowledgment from client
    5. Update nudge.acknowledged in database
    """
```

**Implementation:**
- Maintain active connections dict: `{interview_id: websocket}`
- Listen for new nudges (poll database or use pub/sub)
- Send nudge JSON to connected admin
- Handle acknowledgments and update database
- Clean up on disconnect

#### Task 1.3: Create Interview Coordinator Service
**File:** `backend/src/services/interview_coordinator.py`

```python
class InterviewCoordinator:
    """Orchestrates the complete bias monitoring pipeline for live interviews."""

    async def process_audio_chunk(
        self,
        interview_id: int,
        admin_id: str,
        audio_data: bytes,
        start_time: datetime,
    ):
        """Complete pipeline: Audio → STT → Store → Bias Analysis → Nudge.

        1. Transcribe audio with STTService
        2. Store transcript in database
        3. If speaker is ADMIN:
           - Run BiasDetectionService.analyze_transcript()
           - Result includes nudge if bias detected
           - Send nudge via WebSocket to admin
        4. Return processing status
        """
```

**Implementation:**
- Dependency injection: db, stt_service, bias_service, nudge_ws_manager
- Coordinate async operations
- Error handling with graceful degradation
- Logging at each step

---

### Phase 2: Backend API Endpoints for Dashboard (1-2 hours)

#### Task 2.1: Add Bias Dashboard Endpoints
**File:** `backend/api.py`

```python
# Get all pending bias flags
@app.get("/admin/bias/flags")
async def get_bias_flags(
    reviewed: Optional[bool] = None,
    severity: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get bias flags requiring review."""

# Get admin bias history
@app.get("/admin/bias/history/{admin_id}")
async def get_admin_bias_history(
    admin_id: str,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get bias history for a specific admin."""

# Get drift metrics
@app.get("/admin/bias/metrics")
async def get_drift_metrics(
    cycle_id: Optional[int] = None,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get evaluator drift metrics."""

# Review and resolve bias flag
@app.put("/admin/bias/flags/{flag_id}/resolve")
async def resolve_bias_flag(
    flag_id: int,
    resolution: str,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Mark a bias flag as reviewed and resolved."""
```

---

### Phase 3: Frontend - NudgeOverlay Component (2-3 hours)

#### Task 3.1: Create NudgeOverlay Component
**File:** `frontend/src/components/NudgeOverlay.tsx`

```typescript
interface NudgeOverlayProps {
  interviewId: number;
  adminId: string;
  onBlock?: () => void; // Callback when interview is blocked
}

export default function NudgeOverlay({ interviewId, adminId, onBlock }: NudgeOverlayProps) {
  /**
   * Connect to WebSocket: /ws/interview/{interviewId}/nudges?admin_id={adminId}
   * Listen for nudge messages
   * Display based on type:
   * - INFO: Blue banner at bottom, auto-dismiss after 5s
   * - WARNING: Yellow banner at top, requires acknowledgment
   * - BLOCK: Red full-screen modal, interview terminated
   *
   * On acknowledge: Send ACK to server, update local state
   */
}
```

**UI Variants:**
- **INFO Nudge**: Blue gradient banner, bottom position, fade in/out animation
- **WARNING Nudge**: Yellow/orange banner, top position, requires click to dismiss
- **BLOCK Nudge**: Red full-screen modal, disable all interview controls, show contact info

**State Management:**
- Track active nudges (can show multiple infos, only one warning/block)
- Queue management (show important nudges first)
- Acknowledgment tracking

#### Task 3.2: Add Nudge Styles
**File:** `frontend/src/components/NudgeOverlay.tsx` (Tailwind classes)

```typescript
const nudgeStyles = {
  info: "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
  warning: "bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900",
  block: "bg-gradient-to-r from-red-600 to-red-700 text-white",
};
```

---

### Phase 4: Frontend - Admin Bias Dashboard (3-4 hours)

#### Task 4.1: Create Bias Dashboard Page
**File:** `frontend/src/app/admin/bias/page.tsx`

**Sections:**
1. **Overview Cards** (top row):
   - Total Interviews Conducted
   - Active Bias Flags
   - Suspended Admins
   - Avg Risk Score

2. **Bias Flags Table** (filterable):
   - Interview ID, Admin, Severity, Type, Date
   - Quick actions: Review, Dismiss, View Details
   - Filter by: reviewed status, severity, date range

3. **Admin Risk Scoreboard**:
   - Table of all admins with bias metrics
   - Columns: Name, Interviews, Incidents, Strikes, Status
   - Color-coded by risk level
   - Quick actions: View History, Suspend/Unsuspend

4. **Trend Charts**:
   - Bias incidents over time (line chart)
   - Most common bias types (bar chart)
   - Evaluator status distribution (pie chart)

#### Task 4.2: Create Bias Flag Detail Modal
**File:** `frontend/src/components/BiasFlagDetail.tsx`

**Content:**
- Full incident details
- Evidence quotes from transcript
- Admin information
- Related analysis data
- Resolution form (textarea + action buttons)

---

### Phase 5: Frontend - Interview Room Integration (2-3 hours)

#### Task 5.1: Add WebSocket Client Hook
**File:** `frontend/src/hooks/useInterviewWebSocket.ts`

```typescript
export function useInterviewWebSocket(interviewId: number, adminId: string) {
  /**
   * Manage two WebSocket connections:
   * 1. Audio streaming: /ws/interview/{id}/audio
   * 2. Nudge delivery: /ws/interview/{id}/nudges
   *
   * Return:
   * - sendAudioChunk(blob: Blob)
   * - nudges: Nudge[]
   * - acknowledgeNudge(nudgeId: number)
   * - connectionStatus: 'connected' | 'disconnected' | 'error'
   */
}
```

#### Task 5.2: Add Audio Capture to Interview Room
**File:** `frontend/src/app/interview/[interviewId]/page.tsx`

**Changes:**
1. Add MediaRecorder to capture local audio
2. Send audio chunks every 1-2 seconds via WebSocket
3. Integrate `useInterviewWebSocket` hook
4. Render `<NudgeOverlay />` component
5. Handle block action (redirect to dashboard, show message)

**Implementation:**
```typescript
// Capture audio from webcam stream
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 16000,
});

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    sendAudioChunk(event.data); // Via WebSocket
  }
};

// Start recording in chunks
mediaRecorder.start(1000); // 1s chunks
```

---

### Phase 6: Frontend - API Client Updates (1 hour)

#### Task 6.1: Update adminApi.ts
**File:** `frontend/src/lib/adminApi.ts`

```typescript
// Bias monitoring endpoints
export const adminApiClient = {
  // ... existing methods ...

  // Bias flags
  getBiasFlags: async (filters?: { reviewed?: boolean; severity?: string }) => {},
  resolveBiasFlag: async (flagId: number, resolution: string) => {},

  // Admin bias history
  getAdminBiasHistory: async (adminId: string) => {},
  getAllAdminBiasMetrics: async () => {},

  // Drift metrics
  getDriftMetrics: async (cycleId?: number) => {},
};
```

---

### Phase 7: Testing & Validation (2-3 hours)

#### Task 7.1: Unit Tests
- STTService transcription accuracy
- BiasDetectionService with mock LLM responses
- NudgeService escalation logic
- Repository CRUD operations

#### Task 7.2: Integration Tests
- WebSocket connection/disconnection
- Audio chunk buffering and processing
- Bias detection pipeline end-to-end
- Nudge delivery and acknowledgment

#### Task 7.3: E2E Testing
1. Start interview as admin
2. Speak biased statement
3. Verify transcript appears in database
4. Verify bias analysis runs
5. Verify nudge appears on screen
6. Acknowledge nudge
7. Verify acknowledgment in database

---

## Implementation Order (Recommended)

### Day 1: Backend Foundation
1. ✅ Phase 1.1: Audio streaming WebSocket (2h)
2. ✅ Phase 1.2: Nudge delivery WebSocket (1h)
3. ✅ Phase 1.3: Interview coordinator (2h)
4. ✅ Phase 2.1: Bias dashboard API endpoints (2h)

### Day 2: Frontend Core
5. ✅ Phase 3.1: NudgeOverlay component (3h)
6. ✅ Phase 5.1: WebSocket client hook (2h)
7. ✅ Phase 5.2: Interview room integration (2h)

### Day 3: Dashboard & Polish
8. ✅ Phase 4.1: Admin bias dashboard page (4h)
9. ✅ Phase 4.2: Bias flag detail modal (1h)
10. ✅ Phase 6.1: API client updates (1h)

### Day 4: Testing
11. ✅ Phase 7: Comprehensive testing (Full day)

---

## Success Criteria

### Functional Requirements
- [ ] Audio streams from interview room to backend
- [ ] Transcripts stored in database with speaker attribution
- [ ] Bias detection runs automatically for admin speech
- [ ] Nudges appear in real-time on admin screen
- [ ] Block nudge terminates interview and creates flag
- [ ] Admin dashboard displays all flags and metrics
- [ ] Super admin can review and resolve flags

### Performance Requirements
- [ ] End-to-end latency: Audio → Nudge < 10 seconds (target: 5s)
- [ ] WebSocket reconnection on disconnect
- [ ] No audio loss during buffering
- [ ] Smooth UI animations for nudges

### Data Integrity
- [ ] All transcripts persisted to database
- [ ] All bias analyses logged
- [ ] All nudges tracked with timestamps
- [ ] Strikes correctly incremented
- [ ] Admin status updated on thresholds

---

## Configuration Checklist

### Environment Variables (backend/.env)
```bash
# Already configured
ENABLE_BIAS_MONITORING=true
BIAS_DETECTION_MODEL=gpt-5-mini
OPENAI_API_KEY=sk-...

# Verify these exist
NUDGE_THRESHOLD_LOW=0.3
NUDGE_THRESHOLD_MEDIUM=0.6
NUDGE_THRESHOLD_HIGH=0.85
STRIKE_LIMIT_PER_INTERVIEW=3
STRIKE_LIMIT_PER_CYCLE=5
STRIKE_RESET_DAYS=90
STT_CHUNK_DURATION_SECONDS=10
```

### Frontend Environment (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| WebSocket disconnects | Auto-reconnect with exponential backoff |
| STT API rate limits | Queue chunks, retry with backoff |
| False positive nudges | High confidence thresholds, manual review |
| Audio quality issues | Validate format, provide user feedback |

### Operational Risks
| Risk | Mitigation |
|------|------------|
| Admin frustration | Soft nudges first, clear explanations |
| Privacy concerns | No audio storage, transcript-only |
| Over-reliance on automation | Human review for all blocks/suspensions |

---

## Next Steps

1. **Immediate**: Start with Phase 1.1 (Audio streaming WebSocket)
2. **Day 1**: Complete all backend infrastructure
3. **Day 2**: Build frontend components
4. **Day 3**: Integration and testing
5. **Day 4**: Bug fixes and documentation

---

**Total Estimated Time**: 3-4 days (24-32 hours)
**Priority**: HIGH - Phase 2 is core feature
**Status**: Ready to implement
