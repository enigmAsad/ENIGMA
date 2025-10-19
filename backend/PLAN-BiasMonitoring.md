# ENIGMA Bias Monitoring System - Implementation Plan

**Version:** 1.0.0
**Status:** Planning → Implementation
**Last Updated:** 2025-10-19

---

## Executive Summary

Implement a **real-time STT + LLM pipeline** to monitor admin evaluators during live interviews for bias and favoritism. The system will provide graduated interventions (soft nudges → warnings → hard blocks) and maintain a comprehensive audit trail of all detected incidents.

### Key Objectives

1. **Real-Time Monitoring**: Stream audio → transcribe → analyze → alert within seconds
2. **Graduated Intervention**: Soft nudges for minor issues, automatic blocking for severe/repeated violations
3. **Comprehensive Audit**: All detections logged to hash chain for tamper-evident records
4. **Evaluator Protection**: Context-aware analysis to avoid false positives
5. **Privacy-Preserving**: Monitor evaluator behavior, not applicant characteristics

---

## Guiding Principles

- **Real-Time Performance**: Sub-5-second latency from speech to nudge
- **Accuracy Over Speed**: Batch transcript chunks (10-15s) for context before analysis
- **Graduated Response**: Educate first, escalate only when necessary
- **Audit Everything**: Every detection (true positive or false positive) goes to audit trail
- **Modular Design**: STT, LLM, and Nudge systems are independently testable
- **Privacy-First**: No recording storage, transcript-only retention with TTL

---

## System Architecture

### Data Flow Pipeline

```
Admin Audio (WebRTC)
    ↓
Audio Capture (Frontend MediaStream)
    ↓
WebSocket → Backend STT Service
    ↓
STT Provider (OpenAI Whisper / Deepgram)
    ↓
Transcript Chunks (10-15s windows)
    ↓
BiasDetectionService (LLM Analysis)
    ↓
├─ No Bias → Store transcript only
├─ Soft Bias → Nudge (info banner)
├─ Moderate Bias → Warning (yellow alert)
└─ Severe Bias / Repeated → Block interview (red alert + session termination)
    ↓
WebSocket → Frontend Nudge UI
    ↓
Audit Trail (live_bias_analysis, bias_flags, audit_logs, hash_chain)
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **STT** | OpenAI Whisper API (Realtime) | Excellent accuracy, streaming support, multilingual |
| **Bias LLM** | GPT-4o-mini | Fast, cost-effective, strong reasoning for bias detection |
| **WebSocket** | FastAPI WebSocket | Already used for WebRTC signaling, low latency |
| **Audio Capture** | MediaRecorder API | Native browser support, real-time streaming |
| **Transcript Storage** | PostgreSQL (JSONB) | Efficient for time-series data with metadata |

---

## Database Schema

### New Tables (6)

#### 1. `live_transcripts`
Stores real-time transcript chunks with speaker attribution.

```sql
CREATE TABLE live_transcripts (
    id SERIAL PRIMARY KEY,
    interview_id INTEGER NOT NULL REFERENCES interviews(id),
    speaker VARCHAR(20) NOT NULL,  -- 'admin' or 'student'
    transcript_text TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    confidence_score FLOAT,  -- STT confidence (0.0-1.0)
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_transcripts_interview ON live_transcripts(interview_id, start_time);
```

#### 2. `live_bias_analysis`
LLM analysis results for each transcript chunk.

```sql
CREATE TABLE live_bias_analysis (
    id SERIAL PRIMARY KEY,
    transcript_id INTEGER NOT NULL REFERENCES live_transcripts(id),
    interview_id INTEGER NOT NULL REFERENCES interviews(id),
    admin_id VARCHAR(50) NOT NULL REFERENCES admin_users(admin_id),

    -- Detection Results
    bias_detected BOOLEAN NOT NULL,
    bias_types VARCHAR(100)[],  -- ['appearance', 'gender', 'accent', 'socioeconomic']
    severity VARCHAR(20) NOT NULL,  -- 'none', 'low', 'medium', 'high', 'critical'
    confidence_score FLOAT NOT NULL,  -- LLM confidence (0.0-1.0)

    -- Evidence
    evidence_quotes TEXT[],  -- Direct quotes triggering detection
    context_summary TEXT,  -- LLM explanation of context
    recommended_action VARCHAR(20) NOT NULL,  -- 'none', 'nudge', 'warn', 'block'

    -- Metadata
    llm_model VARCHAR(50) NOT NULL,
    llm_response_raw JSONB,  -- Full LLM output for debugging
    analyzed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_analysis_interview ON live_bias_analysis(interview_id, analyzed_at);
CREATE INDEX idx_analysis_admin ON live_bias_analysis(admin_id, analyzed_at);
```

#### 3. `live_nudges`
Nudges/warnings delivered to admins during interviews.

```sql
CREATE TABLE live_nudges (
    id SERIAL PRIMARY KEY,
    interview_id INTEGER NOT NULL REFERENCES interviews(id),
    analysis_id INTEGER NOT NULL REFERENCES live_bias_analysis(id),
    admin_id VARCHAR(50) NOT NULL REFERENCES admin_users(admin_id),

    -- Nudge Details
    nudge_type VARCHAR(20) NOT NULL,  -- 'info', 'warning', 'block'
    message TEXT NOT NULL,
    display_duration INTEGER,  -- Seconds (NULL for blocks)

    -- Response Tracking
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    dismissed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_nudges_interview ON live_nudges(interview_id, created_at);
```

#### 4. `bias_flags`
Critical incidents requiring admin review.

```sql
CREATE TABLE bias_flags (
    id SERIAL PRIMARY KEY,
    interview_id INTEGER NOT NULL REFERENCES interviews(id),
    admin_id VARCHAR(50) NOT NULL REFERENCES admin_users(admin_id),
    application_id VARCHAR(50),  -- May be NULL during interview

    -- Flag Details
    flag_type VARCHAR(50) NOT NULL,  -- 'severe_bias', 'repeated_violation', 'policy_breach'
    severity VARCHAR(20) NOT NULL,  -- 'high', 'critical'
    description TEXT NOT NULL,
    evidence JSONB NOT NULL,  -- {quotes, analysis_ids, transcript_ids}

    -- Actions Taken
    action_taken VARCHAR(50) NOT NULL,  -- 'interview_blocked', 'admin_suspended', 'under_review'
    automatic BOOLEAN DEFAULT TRUE,  -- Auto-triggered vs manual flag

    -- Review Workflow
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(50) REFERENCES admin_users(admin_id),
    reviewed_at TIMESTAMP,
    resolution TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_flags_admin ON bias_flags(admin_id, created_at);
CREATE INDEX idx_flags_review ON bias_flags(reviewed, severity);
```

#### 5. `drift_metrics`
Track evaluator consistency over time.

```sql
CREATE TABLE drift_metrics (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(50) NOT NULL REFERENCES admin_users(admin_id),
    admission_cycle_id INTEGER REFERENCES admission_cycles(id),

    -- Metrics Window
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    -- Bias Metrics
    total_interviews INTEGER NOT NULL DEFAULT 0,
    bias_incidents INTEGER NOT NULL DEFAULT 0,
    nudges_delivered INTEGER NOT NULL DEFAULT 0,
    warnings_delivered INTEGER NOT NULL DEFAULT 0,
    blocks_triggered INTEGER NOT NULL DEFAULT 0,

    -- Scoring Metrics
    avg_score_given FLOAT,
    score_variance FLOAT,
    harsh_outlier_count INTEGER DEFAULT 0,  -- Scores >2 std below mean
    lenient_outlier_count INTEGER DEFAULT 0,  -- Scores >2 std above mean

    -- Inter-Rater Reliability (if multiple evaluators per applicant)
    irr_correlation FLOAT,  -- Correlation with peer scores

    -- Risk Assessment
    risk_score FLOAT,  -- Composite risk (0.0-1.0)
    risk_level VARCHAR(20),  -- 'low', 'medium', 'high', 'critical'

    calculated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_drift_admin ON drift_metrics(admin_id, period_end);
```

#### 6. `admin_bias_history`
Aggregate bias history for admin management.

```sql
CREATE TABLE admin_bias_history (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(50) NOT NULL REFERENCES admin_users(admin_id),

    -- Lifetime Metrics
    total_interviews_conducted INTEGER NOT NULL DEFAULT 0,
    total_bias_incidents INTEGER NOT NULL DEFAULT 0,
    total_blocks_received INTEGER NOT NULL DEFAULT 0,

    -- Current Status
    current_status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'warned', 'suspended', 'banned'
    suspension_count INTEGER NOT NULL DEFAULT 0,
    last_incident_date TIMESTAMP,

    -- Thresholds for Escalation
    strikes INTEGER NOT NULL DEFAULT 0,  -- 3 strikes = suspension
    strike_reset_date TIMESTAMP,  -- Strikes reset after 90 days clean

    -- Notes
    notes TEXT,

    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_bias_history_admin ON admin_bias_history(admin_id);
```

---

## API Schemas (Pydantic Models)

### Request/Response Schemas

```python
# src/models/schemas.py

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

# Enums
class SpeakerEnum(str, Enum):
    ADMIN = "admin"
    STUDENT = "student"

class BiasTypeEnum(str, Enum):
    APPEARANCE = "appearance"
    GENDER = "gender"
    ACCENT = "accent"
    SOCIOECONOMIC = "socioeconomic"
    NAME = "name"
    PERSONAL_CONNECTION = "personal_connection"
    IRRELEVANT_FACTOR = "irrelevant_factor"

class SeverityEnum(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class NudgeTypeEnum(str, Enum):
    INFO = "info"
    WARNING = "warning"
    BLOCK = "block"

class RecommendedActionEnum(str, Enum):
    NONE = "none"
    NUDGE = "nudge"
    WARN = "warn"
    BLOCK = "block"

class AdminStatusEnum(str, Enum):
    ACTIVE = "active"
    WARNED = "warned"
    SUSPENDED = "suspended"
    BANNED = "banned"

# Request Models
class TranscriptChunkRequest(BaseModel):
    interview_id: int
    speaker: SpeakerEnum
    transcript_text: str
    start_time: datetime
    end_time: datetime
    confidence_score: Optional[float] = None

class BiasAnalysisRequest(BaseModel):
    transcript_id: int
    interview_id: int
    admin_id: str
    transcript_text: str
    conversation_context: Optional[List[str]] = None  # Previous chunks for context

# Response Models
class TranscriptChunkResponse(BaseModel):
    id: int
    interview_id: int
    speaker: str
    transcript_text: str
    start_time: datetime
    end_time: datetime
    confidence_score: Optional[float]
    created_at: datetime

class BiasAnalysisResponse(BaseModel):
    id: int
    transcript_id: int
    interview_id: int
    admin_id: str
    bias_detected: bool
    bias_types: Optional[List[BiasTypeEnum]]
    severity: SeverityEnum
    confidence_score: float
    evidence_quotes: Optional[List[str]]
    context_summary: Optional[str]
    recommended_action: RecommendedActionEnum
    llm_model: str
    analyzed_at: datetime

class LiveNudgeResponse(BaseModel):
    id: int
    interview_id: int
    nudge_type: NudgeTypeEnum
    message: str
    display_duration: Optional[int]
    created_at: datetime

class BiasFlagResponse(BaseModel):
    id: int
    interview_id: int
    admin_id: str
    flag_type: str
    severity: SeverityEnum
    description: str
    action_taken: str
    automatic: bool
    reviewed: bool
    created_at: datetime

class AdminBiasHistoryResponse(BaseModel):
    admin_id: str
    total_interviews_conducted: int
    total_bias_incidents: int
    total_blocks_received: int
    current_status: AdminStatusEnum
    strikes: int
    last_incident_date: Optional[datetime]
```

---

## Implementation Phases

### Phase 1: Backend Foundation (Database & Models) ✅

**Tasks:**
1. Add Pydantic schemas to `src/models/schemas.py`
2. Create SQLAlchemy models in `src/database/models.py`
3. Generate Alembic migration
4. Apply migration to database

**Acceptance Criteria:**
- All 6 tables created successfully
- Models have proper relationships and indexes
- Migration runs without errors

---

### Phase 2: STT Integration Service 🔄

**Tasks:**
1. Add OpenAI Whisper dependency to `pyproject.toml`
2. Create `src/services/stt_service.py` for STT integration
3. Create WebSocket endpoint `/ws/interview/{interview_id}/stt` for audio streaming
4. Implement audio chunk processing and transcript storage
5. Create `TranscriptRepository` in `src/database/repositories/transcript_repository.py`

**Service Design:**

```python
# src/services/stt_service.py

class STTService:
    """Real-time speech-to-text service using OpenAI Whisper."""

    async def transcribe_audio_chunk(
        self,
        audio_data: bytes,
        language: str = "en"
    ) -> TranscriptResult:
        """Send audio chunk to Whisper API and return transcript."""
        pass

    async def process_transcript_stream(
        self,
        interview_id: int,
        speaker: str,
        transcript: str,
        timestamp: datetime
    ) -> int:
        """Store transcript chunk and trigger bias analysis."""
        pass
```

**Acceptance Criteria:**
- Audio streams from frontend to backend via WebSocket
- Transcripts stored in `live_transcripts` table with correct speaker attribution
- Sub-3-second latency from audio to database storage

---

### Phase 3: Bias Detection LLM Service 🔄

**Tasks:**
1. Create `src/services/bias_detection_service.py` with GPT-4o-mini integration
2. Design bias detection prompt with examples and rubric
3. Implement structured output parsing with Pydantic
4. Create `BiasRepository` in `src/database/repositories/bias_repository.py`
5. Add configuration for bias detection thresholds

**Service Design:**

```python
# src/services/bias_detection_service.py

class BiasDetectionService:
    """LLM-based bias detection for interview transcripts."""

    async def analyze_transcript(
        self,
        transcript_id: int,
        transcript_text: str,
        conversation_context: List[str],
        interview_context: dict
    ) -> BiasAnalysisResult:
        """Analyze transcript chunk for bias indicators."""
        pass

    def _build_detection_prompt(
        self,
        transcript: str,
        context: List[str],
        rubric: dict
    ) -> str:
        """Build context-aware bias detection prompt."""
        pass

    def _parse_llm_response(
        self,
        response: str
    ) -> BiasAnalysisResult:
        """Parse structured LLM output into BiasAnalysisResult."""
        pass
```

**Bias Detection Prompt Template:**

```
You are an expert bias detection system monitoring an admission interview evaluator.

CONTEXT:
- This is a merit-based university admission interview
- The evaluator (admin) should focus ONLY on: communication skills, critical thinking, motivation, academic fit
- The evaluator MUST NOT reference: appearance, gender, name, accent, socioeconomic status, personal connections, or other irrelevant factors

RUBRIC VIOLATIONS (BIAS INDICATORS):
1. APPEARANCE: Comments on clothing, physical features, attractiveness
2. GENDER: References to gender identity or stereotypes
3. NAME: Assumptions based on name origin or ethnicity
4. ACCENT: Negative comments about pronunciation or dialect
5. SOCIOECONOMIC: Judgments based on wealth indicators or background
6. PERSONAL_CONNECTION: Mentions of shared contacts, family ties, or favoritism
7. IRRELEVANT_FACTOR: Any non-merit discussion

CONVERSATION HISTORY:
{context}

CURRENT EVALUATOR STATEMENT:
"{transcript}"

ANALYZE FOR BIAS:
1. Is there bias detected? (yes/no)
2. If yes, what types? (list from rubric)
3. Severity: none/low/medium/high/critical
4. Evidence: Direct quotes showing bias
5. Context summary: Why this is/isn't bias
6. Recommended action: none/nudge/warn/block

Respond in JSON format:
{
  "bias_detected": boolean,
  "bias_types": [string],
  "severity": string,
  "confidence_score": float,
  "evidence_quotes": [string],
  "context_summary": string,
  "recommended_action": string
}
```

**Acceptance Criteria:**
- LLM analyzes transcripts with <2-second latency
- Structured JSON output parsed correctly
- Analysis results stored in `live_bias_analysis` table
- False positive rate <10% (validated with test cases)

---

### Phase 4: Nudge System & Escalation Logic 🔄

**Tasks:**
1. Create `src/services/nudge_service.py` for nudge management
2. Implement graduated response logic (info → warning → block)
3. Create WebSocket endpoint `/ws/interview/{interview_id}/nudges` for real-time delivery
4. Implement admin blocking mechanism
5. Create `NudgeRepository` in `src/database/repositories/nudge_repository.py`
6. Add strike tracking and auto-escalation

**Service Design:**

```python
# src/services/nudge_service.py

class NudgeService:
    """Manage nudge delivery and admin escalation."""

    async def process_bias_detection(
        self,
        analysis: BiasAnalysisResult,
        interview_id: int,
        admin_id: str
    ) -> Optional[LiveNudge]:
        """Determine and deliver appropriate nudge based on analysis."""
        pass

    async def deliver_nudge(
        self,
        interview_id: int,
        admin_id: str,
        nudge_type: NudgeTypeEnum,
        message: str
    ) -> int:
        """Send nudge via WebSocket and store in database."""
        pass

    async def check_escalation_threshold(
        self,
        admin_id: str,
        interview_id: int
    ) -> bool:
        """Check if admin has crossed escalation thresholds."""
        pass

    async def block_interview(
        self,
        interview_id: int,
        admin_id: str,
        reason: str
    ) -> None:
        """Immediately block interview and flag for review."""
        pass

    async def update_admin_strikes(
        self,
        admin_id: str,
        incident_severity: SeverityEnum
    ) -> None:
        """Update admin strike count and status."""
        pass
```

**Escalation Logic:**

```
Severity: NONE → No action
Severity: LOW → Info nudge (blue banner, 5s display)
Severity: MEDIUM → Warning nudge (yellow banner, 10s display, +1 strike)
Severity: HIGH → Warning + Strike (+2 strikes, logged to bias_flags)
Severity: CRITICAL → Immediate block + Flag (interview terminated, admin review required)

Strike Thresholds:
- 3 strikes in single interview → Immediate block + suspension
- 5 strikes across cycle → Admin suspended from interviewing
- 10 lifetime strikes → Permanent ban from evaluator pool

Strike Reset: 90 days clean record resets strikes to 0
```

**Acceptance Criteria:**
- Nudges delivered to frontend via WebSocket within 1 second
- Correct escalation logic based on severity and history
- Admin blocking prevents further interview participation
- All actions logged to `bias_flags` and `audit_logs`

---

### Phase 5: Audit Trail Integration 🔄

**Tasks:**
1. Create audit log entries for all bias detections
2. Generate hash chain entries for critical incidents (HIGH/CRITICAL severity)
3. Link audit entries to anonymized application IDs
4. Implement audit verification endpoint
5. Update `AuditRepository` with bias-specific queries

**Audit Events:**

```python
# New AuditActionEnum values
BIAS_DETECTED = "bias_detected"
NUDGE_DELIVERED = "nudge_delivered"
ADMIN_BLOCKED = "admin_blocked"
BIAS_FLAG_CREATED = "bias_flag_created"
ADMIN_SUSPENDED = "admin_suspended"
```

**Hash Chain Integration:**

```
For CRITICAL incidents:
1. Create audit_log entry with action=BIAS_DETECTED
2. Payload: {analysis_id, admin_id, severity, bias_types, evidence}
3. Generate hash chain entry linking to anonymized_application_id
4. Store previous_hash from last hash chain entry
```

**Acceptance Criteria:**
- All bias detections logged to `audit_logs`
- Critical incidents added to hash chain
- Audit trail verifiable via `/admin/audit/verify-chain`
- Anonymized application IDs linked correctly

---

### Phase 6: Drift Metrics & Analytics 🔄

**Tasks:**
1. Create `src/services/drift_metrics_service.py` for analytics
2. Implement background job to calculate metrics (daily/weekly)
3. Create admin dashboard API endpoints for metrics viewing
4. Implement inter-rater reliability calculations (if multiple evaluators)
5. Create alerting for high-risk evaluators

**Metrics Calculated:**

```
Per Admin:
- Bias incident rate (incidents / interviews)
- Average severity score
- Strike accumulation rate
- Scoring outlier frequency (harsh vs lenient)
- Inter-rater correlation (if applicable)
- Risk score (composite 0.0-1.0)

Per Cycle:
- Aggregate bias detection rate
- Most common bias types
- Evaluator consistency variance
- False positive audit results
```

**Acceptance Criteria:**
- Metrics calculated correctly for all active admins
- High-risk admins flagged automatically
- Dashboard displays metrics with historical trends
- Alerts sent to super_admins for critical risk scores

---

### Phase 7: Frontend - Nudge UI Components 🔄

**Tasks:**
1. Create `NudgeOverlay.tsx` component for in-interview alerts
2. Add WebSocket client for receiving nudges
3. Implement different UI states (info, warning, block)
4. Create admin bias dashboard page
5. Add bias metrics to admin profile

**Component Design:**

```tsx
// src/components/NudgeOverlay.tsx

interface NudgeOverlayProps {
  interviewId: number;
  adminId: string;
}

// Displays real-time nudges during interview
// - Info (blue): Bottom banner, auto-dismiss after 5s
// - Warning (yellow): Top banner, requires acknowledgment
// - Block (red): Full-screen modal, interview terminated
```

**Acceptance Criteria:**
- Nudges appear within 1 second of backend delivery
- Different visual styles for each severity level
- Block nudge prevents further interview interaction
- Nudge acknowledgment tracked in database

---

### Phase 8: Frontend - Admin Bias Dashboard 🔄

**Tasks:**
1. Create `/admin/bias/page.tsx` for bias overview
2. Display admin bias history and metrics
3. Show active bias flags requiring review
4. Implement bias flag resolution workflow
5. Add link to dashboard from admin navigation

**Dashboard Sections:**

```
1. Overview Cards:
   - Total Interviews Conducted
   - Total Bias Incidents
   - Active Flags Pending Review
   - Suspended Admins

2. Bias Flags Table:
   - Interview ID, Admin, Severity, Type, Date
   - Quick actions: Review, Dismiss, Escalate

3. Admin Risk Scoreboard:
   - List of admins with risk scores
   - Color-coded by risk level
   - Quick suspension controls

4. Trend Charts:
   - Bias incidents over time
   - Most common bias types
   - Evaluator drift metrics
```

**Acceptance Criteria:**
- Dashboard loads all data correctly
- Bias flags can be reviewed and resolved
- Admin risk scores update in real-time
- Historical trends visualized clearly

---

### Phase 9: Testing & Validation 🔄

**Tasks:**
1. Create unit tests for bias detection service (false positive/negative cases)
2. Integration tests for STT → LLM → Nudge pipeline
3. Load testing for WebSocket connections (10+ concurrent interviews)
4. Manual testing with scripted interview scenarios
5. Bias detection accuracy validation with labeled dataset

**Test Scenarios:**

```
Positive Cases (Should Detect):
- "She seems well-dressed for someone from that area"
- "His accent makes it hard to understand his points"
- "I know his father, he's a good man"
- "You're very articulate for a [demographic]"

Negative Cases (Should NOT Detect):
- "Your essay demonstrated strong critical thinking"
- "Can you explain your research methodology?"
- "What motivates you to study this field?"
- "How would you contribute to our academic community?"

Edge Cases:
- Contextual mentions (discussing discrimination faced)
- Language barriers (genuine communication difficulties)
- Cultural references (appropriate vs inappropriate)
```

**Acceptance Criteria:**
- >90% accuracy on labeled test set
- <5% false positive rate
- Pipeline processes 10 concurrent interviews without errors
- End-to-end latency <5 seconds (audio → nudge)

---

### Phase 10: Documentation & Deployment 🔄

**Tasks:**
1. Update `BACKEND.md` with bias monitoring architecture
2. Update `FRONTEND.md` with nudge UI components
3. Create `BIAS_MONITORING.md` operational guide
4. Add environment variables to `.env.example`
5. Update deployment checklist
6. Create admin training guide for bias system

**Documentation Sections:**

```
BIAS_MONITORING.md:
- System architecture and data flow
- Bias detection rubric and examples
- Escalation thresholds and policies
- Admin responsibilities and best practices
- False positive handling procedures
- Incident review workflow
- Privacy and data retention policies
```

**Acceptance Criteria:**
- All technical documentation updated
- Operational runbook created
- Environment variables documented
- Deployment tested successfully

---

## Configuration

### Environment Variables

```bash
# .env additions

# Bias Monitoring
ENABLE_BIAS_MONITORING=true
WHISPER_API_KEY=your_openai_api_key  # May reuse OPENAI_API_KEY
BIAS_DETECTION_MODEL=gpt-4o-mini
BIAS_DETECTION_TEMPERATURE=0.2

# Thresholds
NUDGE_THRESHOLD_LOW=0.3  # Confidence score for info nudge
NUDGE_THRESHOLD_MEDIUM=0.6  # Confidence score for warning
NUDGE_THRESHOLD_HIGH=0.85  # Confidence score for block
STRIKE_LIMIT_PER_INTERVIEW=3
STRIKE_LIMIT_PER_CYCLE=5
STRIKE_RESET_DAYS=90

# Performance
STT_CHUNK_DURATION_SECONDS=10  # Audio chunk size for STT
BIAS_ANALYSIS_BATCH_SIZE=1  # Analyze 1 transcript at a time (real-time)
TRANSCRIPT_RETENTION_DAYS=365  # How long to keep transcripts
```

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| STT latency >5s | Medium | High | Use streaming STT, optimize chunk size |
| False positives | High | Medium | Require HIGH confidence for blocks, log all for review |
| WebSocket instability | Low | High | Implement reconnection logic, fallback to polling |
| LLM rate limits | Medium | High | Implement retry with exponential backoff, local cache |
| Audio quality issues | High | Medium | Validate audio format, require minimum quality threshold |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Admin pushback | Medium | High | Education first, soft nudges initially, escalate slowly |
| Privacy concerns | Medium | High | No recording storage, transcript-only, clear policies |
| False positives erode trust | High | Medium | Transparent audit trail, easy dispute resolution |
| Over-reliance on automation | Medium | High | Human review required for suspensions, appeal process |

---

## Success Metrics

### Performance KPIs

- **Latency**: Audio → Nudge <5 seconds (95th percentile)
- **Accuracy**: >90% on labeled test set
- **False Positive Rate**: <5%
- **Uptime**: >99.5% for bias monitoring service

### Impact KPIs

- **Bias Incident Reduction**: 30% decrease in detected bias after 3 months
- **Evaluator Satisfaction**: >80% of admins report nudges are helpful (survey)
- **Audit Compliance**: 100% of critical incidents logged to hash chain
- **Dispute Resolution**: <48 hours for bias flag review

---

## Future Enhancements

### Phase 2.1 (Post-MVP)

1. **Multi-Language Support**: Urdu, regional dialects
2. **Voice Sentiment Analysis**: Detect tone, frustration, favoritism cues
3. **Evaluator Training Feedback Loop**: Auto-generate training materials from incidents
4. **Applicant Sentiment Tracking**: Monitor student comfort level (distress detection)
5. **Advanced Analytics**: ML model for evaluator risk prediction
6. **Bias Pattern Library**: Crowd-sourced bias examples for continuous improvement

### Phase 2.2 (Enterprise)

1. **Self-Hosted STT**: Privacy-preserving local deployment
2. **Federated Learning**: Improve bias detection without centralizing data
3. **Real-Time Intervention**: Auto-pause interviews on critical bias for human review
4. **Blockchain Audit**: Immutable audit trail on distributed ledger
5. **Regulatory Compliance**: GDPR, FERPA, local privacy law alignment

---

## Changelog

### v1.0.0 (2025-10-19) - Initial Plan
- Comprehensive architecture design
- Database schema (6 new tables)
- 10-phase implementation roadmap
- Risk assessment and success metrics

---

**Document Version:** 1.0.0
**Maintainer:** ENIGMA Development Team
**Status:** Ready for Implementation ✅
