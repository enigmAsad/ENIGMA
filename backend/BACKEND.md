# ENIGMA Backend - Technical Documentation

**Version:** 2.3.0
**Last Updated:** 2025-10-19
**Python Version:** 3.12+
**Status:** Production Ready (Phase 1 + Phase 2 Bias Monitoring)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Database Schema](#database-schema)
5. [Data Models & Schemas](#data-models--schemas)
6. [API Reference](#api-reference)
7. [9-Phase Workflow](#9-phase-workflow)
8. [LLM Integration](#llm-integration)
9. [Security Architecture](#security-architecture)
10. [Configuration Management](#configuration-management)
11. [Development & Testing](#development--testing)
12. [Deployment Guide](#deployment-guide)
13. [Performance & Optimization](#performance--optimization)
14. [Troubleshooting](#troubleshooting)

---

## Executive Summary

ENIGMA is an **AI-powered blind merit screening system** designed to eliminate bias in university admissions through a production-ready PostgreSQL backend with a **9-phase workflow** for automated LLM processing, comprehensive audit logging, and enterprise-grade security.

### Phase 1.5 Student Accounts Progress

**Completed for Update Phase 1 (100%)**
- Added student authentication schema (accounts, OAuth identities, sessions, PKCE state) with Alembic migration `20251014_0000_add_student_accounts`.
- Implemented core repositories and `StudentAuthService` to manage Google OAuth exchange, account provisioning, and session lifecycle.
- Extended application models/schemas to link submissions to authenticated student accounts and enforce per-cycle uniqueness.
- Updated configuration to require Google OAuth credentials and student session TTL settings.
- Exposed student-facing endpoints (`/auth/student/google/callback`, `/auth/student/logout`, `/auth/student/me`) with HttpOnly session cookies wired into the flow.
- Enforced authenticated submission path in `/applications`, migrated legacy records, and validated per-cycle duplicate prevention.
- Added automated tests covering OAuth state validation, session issuance/revocation, and authenticated submission flow.
- Finalized documentation, environment samples, and operational runbooks for Google OAuth configuration and student dashboard integration.

**Status:** Student authentication phase is fully implemented; no outstanding items remain for Update Phase 1.

### Phase 2 Bias Monitoring System (NEW)

**Completed (100%)**
- Real-time STT (Speech-to-Text) integration using OpenAI Whisper API for live interview transcription
- LangGraph workflow orchestration for bias detection pipeline (Audio → STT → Analysis → Nudge → Action)
- LLM-based bias detection using GPT-5-mini with context-aware analysis
- Graduated nudge system (Info → Warning → Block) with automatic escalation
- Strike tracking and admin status management (Active → Warned → Suspended → Banned)
- Six new database tables for comprehensive bias monitoring and audit
- Real-time WebSocket support for audio streaming and nudge delivery
- Bias flag system for critical incidents requiring review
- Drift metrics for evaluator consistency tracking over time

**Key Components:**
- **BiasMonitoringWorkflow**: LangGraph state machine for orchestrating the complete detection pipeline
- **STTService**: Real-time audio transcription with buffering and chunk management
- **BiasDetectionService**: LLM analysis using GPT-5-mini with structured JSON output
- **NudgeService**: Graduated response logic with strike thresholds and auto-blocking
- **Comprehensive Repositories**: Transcript, BiasAnalysis, Nudge, BiasFlag, DriftMetrics, AdminBiasHistory

**Status:** Phase 2 bias monitoring is fully implemented and ready for production deployment.

### Key Features

- **Blind Evaluation**: Complete PII removal with Fernet encryption
- **9-Phase Workflow**: Structured admission cycle management
- **Real-Time Bias Monitoring**: Live STT + LLM analysis during interviews
- **LangGraph Orchestration**: State machine workflow for bias detection pipeline
- **Batch Processing**: JSONL export/import for LLM pipelines
- **Worker-Judge Architecture**: Dual-tier LLM validation
- **Cryptographic Audit Trail**: SHA-256 hash chain + audit logs
- **Repository Pattern**: Clean separation of concerns
- **ACID Compliance**: Transactional integrity with PostgreSQL
- **RESTful API**: FastAPI-based web service
- **Scalable**: Supports 1M+ applications with proper indexing

### Technology Stack

```
Language:        Python 3.12
Web Framework:   FastAPI 0.109+
Database:        PostgreSQL (Supabase)
ORM:             SQLAlchemy 2.0+
Migrations:      Alembic 1.13+
AI/ML:           OpenAI GPT-5, GPT-5-mini
STT:             OpenAI Whisper API (real-time transcription)
Orchestration:   LangGraph 0.0.20+ (bias monitoring workflow)
Validation:      Pydantic v2.5+
Encryption:      Fernet (cryptography 41.0+)
Authentication:  JWT (pyjwt 2.8+)
Password Hash:   bcrypt 4.1+
NLP:             spaCy 3.7+ (for PII detection)
WebSockets:      FastAPI WebSocket (real-time audio/nudge streaming)
```

---

## System Architecture

ENIGMA uses a layered architecture with FastAPI serving as the web framework, PostgreSQL as the database, and a service-oriented design for business logic.

### Architecture Overview

```
FastAPI (REST API + WebSocket + JWT Auth)
       ↓
Repository Layer (Data Access)
  ApplicationRepo | AdminRepo | BatchRepo | AuditRepo | InterviewRepo
  TranscriptRepo | BiasAnalysisRepo | NudgeRepo | BiasFlagRepo | DriftMetricsRepo
       ↓
PostgreSQL Database (20 Tables: 14 Core + 6 Bias Monitoring)
       ↓
Services Layer (Business Logic)
  Phase 1: IdentityScrubber | PhaseManager | BatchProcessor | AdminAuth
  Phase 2: STTService | BiasDetectionService | NudgeService | BiasMonitoringWorkflow
       ↓
LangGraph Pipeline (Bias Monitoring Workflow)
  Audio → STT → Transcript → Analysis → Nudge Decision → Action
```

### Key Layers

**Web Layer:** FastAPI with JWT auth, Pydantic validation, and WebSocket support
**Data Layer:** Repository pattern with SQLAlchemy ORM (20 tables)
**Service Layer:** Phase 1 admissions workflow + Phase 2 bias monitoring
**Workflow Layer:** LangGraph state machine for bias detection orchestration
**Database:** PostgreSQL with 20 normalized tables and proper indexing

---

## Core Components

### Database Engine (`src/database/engine.py`)
Manages PostgreSQL connection pooling and session lifecycle with SQLAlchemy 2.0, QueuePool, and Supabase transaction pooler support.

### Repository Pattern (`src/database/repositories/`)
Clean data access layer with CRUD operations:

**Phase 1 Repositories:**
- `ApplicationRepository`: Application lifecycle, anonymization, metrics
- `AdminRepository`: Admin users, sessions, admission cycles, phase transitions
- `BatchRepository`: Batch runs, LLM results, final scores
- `AuditRepository`: Audit logs, hash chain management
- `InterviewRepository`: Interview scheduling and management

**Phase 2 Bias Monitoring Repositories:**
- `TranscriptRepository`: Live interview transcripts with speaker attribution
- `BiasAnalysisRepository`: LLM bias analysis results and confidence scores
- `NudgeRepository`: Nudge delivery and acknowledgment tracking
- `BiasFlagRepository`: Critical bias incidents requiring review
- `DriftMetricsRepository`: Evaluator consistency metrics over time
- `AdminBiasHistoryRepository`: Aggregate bias history and strike management

### Identity Scrubber (`src/services/identity_scrubber.py`)
Removes PII and encrypts identity mappings using Fernet encryption. Process: fetch → scrub → anonymize → encrypt → audit.

### STT Service (`src/services/stt_service.py`)
Real-time speech-to-text transcription using OpenAI Whisper API. Features audio buffering, chunk management (10-15s windows), and automatic transcript storage with speaker attribution.

### Bias Detection Service (`src/services/bias_detection_service.py`)
LLM-based bias detection using LangGraph workflow orchestration. Analyzes admin transcripts using GPT-5-mini with context-aware prompts, structured JSON output, and confidence scoring.

### Nudge Service (`src/services/nudge_service.py`)
Graduated bias response system with automatic escalation logic. Manages strike tracking, admin status updates, and automated interview blocking based on configurable thresholds.

### Bias Monitoring Workflow (`src/services/bias_monitoring_workflow.py`)
LangGraph state machine orchestrating the complete bias monitoring pipeline: analyze_bias → store_analysis → check_strikes → take_action. Implements retry logic, error handling, and conditional routing.

### Admin Authentication (`src/services/admin_auth.py`)
JWT-based authentication with PostgreSQL session management, bcrypt password hashing, and automatic session cleanup.

**Authentication Dependency:** The `get_current_admin` dependency in `api.py` returns `Dict[str, Any]` with session data:
```python
{
    "admin_id": "ADM_12345678",
    "username": "admin_username",
    "email": "admin@example.com",
    "role": "admin"
}
```
All admin endpoints access this data via dictionary keys (e.g., `admin["admin_id"]` not `admin.admin_id`).

### Batch Processor (`src/services/batch_processor.py`)
Exports applications to JSONL, orchestrates the internal Worker/Judge LLM pipeline, and imports results back into the database.

### Worker LLM (`src/services/worker_llm.py`)
Evaluates anonymized applications using OpenAI models, persists `worker_results` records, and logs outcomes for auditing.

### Judge LLM (`src/services/judge_llm.py`)
Validates Worker evaluations, persists `judge_results`, and enforces bias/rubric checks before final scores are committed.

### Hash Chain Generator (`src/services/hash_chain.py`)
Creates SHA-256 linked audit entries for every finalized score, ensuring a tamper-evident decision trail that can be verified on demand.

### Phase Manager (`src/services/phase_manager.py`)
Manages 9-phase admission cycle workflow with validation gates and state transitions.

### Encryption Service (`src/utils/encryption.py`)
Fernet symmetric encryption for PII storage with key generation and secure encrypt/decrypt operations.

---

## Database Schema

ENIGMA uses a normalized PostgreSQL schema with **20 tables** (14 Phase 1 + 6 Phase 2), proper relationships, indexes, and constraints.

### Phase 1 Core Tables (10)

1. **`applications`** - Raw student submissions with PII (name, email, phone, address, GPA, test scores, essay, achievements)
2. **`anonymized_applications`** - PII-scrubbed data for LLM processing (GPA, test scores, scrubbed essay/achievements)
3. **`identity_mapping`** - Encrypted PII storage using Fernet (links anonymized to original applications)
4. **`deterministic_metrics`** - Pre-computed metrics (test average, academic score, percentile rank)
5. **`batch_runs`** - LLM batch processing jobs (input/output paths, status, record counts)
6. **`worker_results`** - Worker LLM evaluation results (academic/test/achievement/essay scores, explanations)
7. **`judge_results`** - Judge LLM validation results (decisions, confidence scores, bias detection)
8. **`final_scores`** - Aggregated scores with selection status (final score, LLM score, selection status)

### Phase 1 Admin & Audit Tables (4)

9. **`admin_users`** - Admin authentication (username, email, password hash, role, activity status)
10. **`admin_sessions`** - JWT session management (token, expiry, IP tracking, revocation status)
11. **`admission_cycles`** - Admission cycle management (phase, dates, seat counts, selection results)
   - **IMPORTANT:** `created_by` field references `admin_users.admin_id` (format: "ADM_XXXXXXXX"), NOT username
12. **`audit_logs`** - Comprehensive audit trail (entity actions, actor, hash chain, timestamps)
13. **`selection_logs`** - Selection process records (criteria, cutoff scores, execution details)
14. **`interviews`** - Interview scheduling and tracking (application_id, student_id, admin_id, time, link, status)

### Phase 2 Bias Monitoring Tables (6)

15. **`live_transcripts`** - Real-time interview transcripts (interview_id, speaker, text, start/end times, confidence score)
16. **`live_bias_analysis`** - LLM bias detection results (transcript_id, bias_detected, bias_types, severity, confidence, evidence, recommended_action, llm_response_raw)
17. **`live_nudges`** - Real-time nudges delivered to admins (interview_id, analysis_id, nudge_type [info/warning/block], message, display_duration, acknowledged)
18. **`bias_flags`** - Critical bias incidents requiring review (interview_id, admin_id, flag_type, severity, evidence, action_taken, reviewed, resolution)
19. **`drift_metrics`** - Evaluator consistency tracking (admin_id, period, bias_incidents, nudges/warnings/blocks counts, avg_score, risk_score, risk_level)
20. **`admin_bias_history`** - Aggregate admin bias tracking (admin_id, total_interviews, total_incidents, strikes, current_status [active/warned/suspended/banned], strike_reset_date)

### Key Relationships

**Phase 1 Relationships:**
```
admission_cycles (1:N) → applications (1:1) → anonymized_applications
anonymized_applications (1:1) → identity_mapping
anonymized_applications (1:N) → worker_results (1:N) → judge_results
anonymized_applications (1:1) → final_scores
applications (1:1) → deterministic_metrics
applications (1:1) → interviews
batch_runs (1:N) → worker_results, judge_results
admin_users (1:N) → admin_sessions
admin_users (1:N) → admission_cycles (via created_by → admin_id)
admission_cycles (1:N) → selection_logs
audit_logs (hash chain across all entities)
```

**Phase 2 Bias Monitoring Relationships:**
```
interviews (1:N) → live_transcripts
interviews (1:N) → live_bias_analysis
interviews (1:N) → live_nudges
interviews (1:N) → bias_flags

live_transcripts (1:N) → live_bias_analysis
live_bias_analysis (1:N) → live_nudges

admin_users (1:N) → live_bias_analysis (monitored admin)
admin_users (1:N) → live_nudges (recipient)
admin_users (1:N) → bias_flags (flagged admin)
admin_users (1:1) → admin_bias_history
admin_users (1:N) → drift_metrics

admission_cycles (1:N) → drift_metrics
```

---

## Data Models & Schemas

ENIGMA uses Pydantic for API validation and SQLAlchemy for ORM mapping.

### Key Enums

**Phase 1 Enums:**
- **AdmissionPhaseEnum:** SUBMISSION | FROZEN | PREPROCESSING | BATCH_PREP | PROCESSING | SCORED | SELECTION | PUBLISHED | COMPLETED
- **ApplicationStatusEnum:** SUBMITTED | FINALIZED | PREPROCESSING | BATCH_READY | PROCESSING | SCORED | SELECTED | NOT_SELECTED | PUBLISHED
- **AdminRoleEnum:** admin | super_admin | auditor
- **InterviewStatusEnum:** SCHEDULED | COMPLETED | CANCELLED

**Phase 2 Bias Monitoring Enums:**
- **SpeakerEnum:** ADMIN | STUDENT
- **BiasTypeEnum:** APPEARANCE | GENDER | NAME | ACCENT | SOCIOECONOMIC | PERSONAL_CONNECTION | IRRELEVANT_FACTOR
- **SeverityEnum:** NONE | LOW | MEDIUM | HIGH | CRITICAL
- **NudgeTypeEnum:** INFO | WARNING | BLOCK
- **RecommendedActionEnum:** NONE | NUDGE | WARN | BLOCK
- **AdminBiasStatusEnum:** ACTIVE | WARNED | SUSPENDED | BANNED

### Core Models

**Application:** Student submissions with PII (name, email, GPA, test scores, essay, achievements)

**AnonymizedApplication:** PII-scrubbed data for LLM processing (scrubbed essay/achievements)

**FinalScore:** Aggregated evaluation results (final score, LLM score, selection status)

**AdminUser:** Administrative user accounts (username, email, role, activity status)

**AdmissionCycle:** Admission cycle management (phase, dates, seat counts, selection results)

---

## API Reference

### Public Endpoints
- `GET /health` - Health check
- `POST /applications` - Submit student application
- `GET /applications/{id}` - Get application status (returns phase-specific messaging, anonymized ID when available, and normalized status values)
- `GET /admission/info` - Get current cycle information
- `GET /admission/status` - Check if admissions are open

### Admin Authentication
- `POST /admin/auth/login` - Admin login (returns JWT)
- `POST /admin/auth/logout` - Admin logout (revokes session)
- `GET /admin/auth/me` - Get current admin information

### Admin Cycle Management (9-Phase Workflow)
- `POST /admin/cycles` - Create new admission cycle
- `GET /admin/cycles` - List all admission cycles
- `GET /admin/cycles/{id}` - Get cycle details
- `PUT /admin/cycles/{id}` - Update cycle settings
- `POST /admin/cycles/{id}/freeze` - Phase 2: Freeze cycle
- `POST /admin/cycles/{id}/preprocess` - Phase 3: Compute metrics
- `POST /admin/cycles/{id}/export` - Phase 4: Export JSONL for LLM
- `POST /admin/cycles/{id}/select` - Phase 7: Top-K selection
- `POST /admin/cycles/{id}/publish` - Phase 8: Publish results
- `POST /admin/cycles/{id}/complete` - Phase 9: Complete cycle

### Admin Batch Processing
- `POST /admin/batch/import` - Import LLM results (Phase 6)
- `GET /admin/batch/{id}/status` - Get batch processing status

### Admin Audit
- `GET /admin/audit/logs` - Retrieve audit logs
- `GET /admin/audit/verify-chain` - Verify hash chain integrity

---

## 9-Phase Workflow

ENIGMA implements a structured 9-phase admission cycle workflow with validation gates between each phase.

### Phase Overview

**Phase 1: SUBMISSION** - Students submit applications via API, validated and stored with seat tracking

**Phase 2: FROZEN** - Admin freezes cycle, marks applications as FINALIZED, creates database snapshot

**Phase 3: PREPROCESSING** - Computes deterministic metrics (test averages, academic scores, percentile ranks)

**Phase 4: BATCH_PREP** - Prepares anonymized applications for LLM evaluation (JSONL snapshot available for external use)

**Phase 5: PROCESSING** - Backend runs internal Worker/Judge LLM services, produces evaluation scores, and writes `final_scores`

**Phase 6: SCORED** - Imports LLM results, updates final_scores table, marks applications as SCORED

**Phase 7: SELECTION** - Performs top-K selection, marks applications as SELECTED/NOT_SELECTED

**Phase 8: PUBLISHED** - Publishes results, makes them available to students via API

**Phase 9: COMPLETED** - Archives cycle, marks as completed for historical reference

### Phase Transitions

| From Phase | To Phase | Trigger | Validation |
|------------|----------|---------|------------|
| SUBMISSION | FROZEN | Admin freeze | Cycle open |
| FROZEN | PREPROCESSING | Admin preprocess | All apps FINALIZED |
| PREPROCESSING | BATCH_PREP | Admin export | Metrics computed |
| BATCH_PREP | PROCESSING | Admin run internal LLM | Applications marked BATCH_READY |
| PROCESSING | SCORED | Internal LLM success | Worker/Judge results persisted |
| SCORED | SELECTION | Admin select | All apps scored |
| SELECTION | PUBLISHED | Admin publish | Selection complete |
| PUBLISHED | COMPLETED | Admin complete | Results published |

### Key APIs by Phase

- **Phase 1:** `POST /applications` (student submissions)
- **Phase 2:** `POST /admin/cycles/{id}/freeze`
- **Phase 3:** `POST /admin/cycles/{id}/preprocess`
- **Phase 4:** `POST /admin/cycles/{id}/export` (creates JSONL snapshot)
- **Phase 5:** `POST /admin/cycles/{id}/processing` (runs internal LLM pipeline and persists results)
- **Phase 6:** `POST /admin/batch/{id}/import` (optional external import path)
- **Phase 7:** `POST /admin/cycles/{id}/select` (top-K selection)
- **Phase 8:** `POST /admin/cycles/{id}/publish`
- **Phase 9:** `POST /admin/cycles/{id}/complete`

---

## LLM Integration

### Batch Processing (Primary)

ENIGMA now ships with an internal batch pipeline (Phases 4-6):

**Workflow:**
1. Export anonymized applications to JSONL (optional artifact for audit/external tooling)
2. Execute internal Worker/Judge LLM services via `POST /admin/cycles/{id}/processing`
3. Persist `worker_results`, `judge_results`, and `final_scores` in PostgreSQL

**Benefits:**
- Single-click automation from the admin portal
- Consistent audit logging and error handling inside the backend
- Optional JSONL export/import retained for offline or large-scale batch scenarios
- Hash-chain entries generated automatically for each `final_scores` write

### Real-Time LLM (Optional)

LangGraph pipeline remains available for real-time evaluation:

**Worker LLM:** Evaluates applications with weighted scoring (Academic 30%, Test 25%, Achievement 25%, Essay 20%)

**Judge LLM:** Validates worker results for bias detection, rubric adherence, and quality issues

**Pipeline:** Retry loop with decision gates, max 3 attempts, stores results in PostgreSQL

### Phase 2: Bias Monitoring Workflow (LangGraph)

ENIGMA Phase 2 uses a **LangGraph state machine** to orchestrate real-time bias detection during live interviews.

**Workflow Overview:**
```
Audio Stream (WebRTC)
    ↓
STT Service (OpenAI Whisper) - 10s chunks
    ↓
Transcript Storage (live_transcripts table)
    ↓
LangGraph Workflow: BiasMonitoringWorkflow
    ├─ Node 1: analyze_bias (GPT-5-mini with context-aware prompt)
    ├─ Node 2: store_analysis (persist to live_bias_analysis)
    ├─ Node 3: check_strikes (count strikes, check admin status)
    └─ Node 4: take_action (conditional - only if bias detected)
        ├─ Info Nudge (blue banner, 5s)
        ├─ Warning (yellow alert, 10s, +strike)
        └─ Block (red alert, terminate interview, create flag)
    ↓
WebSocket → Frontend (real-time nudge delivery)
```

**Key Features:**
- **GPT-5-mini LLM**: Fast, accurate bias detection with structured JSON output (no temperature/max_tokens params - not supported)
- **Context-Aware**: Analyzes current statement with 5 previous transcript chunks for full context
- **Graduated Response**: Info (confidence ≥0.3) → Warning (≥0.6) → Block (≥0.85)
- **Strike Tracking**: 3 strikes in interview → auto-block, 5 strikes in cycle → suspension
- **State Machine**: LangGraph nodes with conditional routing based on severity and strike count
- **Error Handling**: Graceful degradation with retry logic and error state tracking

**LLM Prompt Structure:**
- System: Bias detection expert with rubric (7 bias types: appearance, gender, name, accent, socioeconomic, personal_connection, irrelevant_factor)
- User: Conversation history + current evaluator statement
- Response: Structured JSON with bias_detected, bias_types, severity, confidence, evidence, context_summary, recommended_action

**Escalation Thresholds:**
- **LOW severity**: Informational nudge, no strike
- **MEDIUM severity**: Warning nudge, +1 strike
- **HIGH severity**: Warning nudge, +2 strikes
- **CRITICAL severity**: Immediate block, +3 strikes, flag for review

**Admin Status Lifecycle:**
```
ACTIVE (0-2 strikes)
    ↓ 3+ strikes in interview
WARNED (3-4 strikes in cycle)
    ↓ 5+ strikes in cycle
SUSPENDED (manual review required)
    ↓ 10+ lifetime strikes
BANNED (permanent removal from evaluator pool)
```

**Strike Reset**: 90 days of clean record automatically resets strikes to 0.

---

## Security Architecture

### Encryption

**PII Protection:** Fernet (AES-128) encryption for all personally identifiable information stored in `identity_mapping` table

**Key Management:** Cryptographically secure keys generated via `scripts/generate_keys.py`

### Authentication

**JWT Implementation:** HS256-signed tokens with configurable expiry, stored in `admin_sessions` table

**Session Features:**
- Token revocation on logout
- Automatic expiry cleanup
- IP address and user agent tracking
- Role-based access control (admin, super_admin, auditor)

### Audit Trail

**Dual System:**
1. **Hash Chain:** SHA-256 sequential hashing for tamper evidence
2. **Audit Logs:** Comprehensive entity tracking with JSONB details and millisecond timestamps

**Verification:** `GET /admin/audit/verify-chain` validates chain integrity

---

## Repository Pattern

Clean data access layer with generic CRUD operations and specialized repositories:

**BaseRepository:** Generic create, read, update, delete operations for all entities

**ApplicationRepository:** Application lifecycle, anonymization, metrics, and scoring operations

**AdminRepository:** Admin users, sessions, admission cycles, and phase transitions

**BatchRepository:** Batch runs, LLM results, and final score management

**AuditRepository:** Audit logs and hash chain management

## Configuration Management

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection (Supabase transaction pooler)
- `ENCRYPTION_KEY` - Fernet encryption key (from scripts/generate_keys.py)
- `JWT_SECRET` - JWT signing secret (from scripts/generate_keys.py)
- `OPENAI_API_KEY` - OpenAI API key for LLM integration (Whisper STT + GPT models)

**Phase 1 Optional:**
- `DATABASE_POOL_SIZE` - Connection pool size (default: 20)
- `ADMIN_TOKEN_EXPIRY_HOURS` - JWT token expiry (default: 24)
- `WORKER_MODEL` - Worker LLM model (default: gpt-5)
- `JUDGE_MODEL` - Judge LLM model (default: gpt-5-mini)
- `BATCH_EXPORT_DIR` - Directory for JSONL exports (default: ./batch_export)

**Phase 2 Bias Monitoring:**
- `ENABLE_BIAS_MONITORING` - Enable bias monitoring (default: true)
- `BIAS_DETECTION_MODEL` - LLM for bias detection (default: gpt-5-mini)
- `NUDGE_THRESHOLD_LOW` - Confidence for info nudges (default: 0.3)
- `NUDGE_THRESHOLD_MEDIUM` - Confidence for warnings (default: 0.6)
- `NUDGE_THRESHOLD_HIGH` - Confidence for blocking (default: 0.85)
- `STRIKE_LIMIT_PER_INTERVIEW` - Strikes before interview block (default: 3)
- `STRIKE_LIMIT_PER_CYCLE` - Strikes before suspension (default: 5)
- `STRIKE_RESET_DAYS` - Days for strike reset (default: 90)
- `STT_CHUNK_DURATION_SECONDS` - Audio chunk duration (default: 10)
- `TRANSCRIPT_RETENTION_DAYS` - Transcript retention period (default: 365)

**Settings:** Pydantic configuration with validation and .env file support

**Path Resolution:** `settings.py` uses absolute path resolution to locate `.env` file regardless of script execution directory:
```python
# settings.py is in: backend/src/config/settings.py
# .env is in: backend/.env
_BACKEND_DIR = Path(__file__).parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"
```
This ensures scripts in `backend/scripts/` can correctly load environment variables.

---

## Development & Testing

### Quick Start

1. **Install:** `uv sync && python -m spacy download en_core_web_sm`
2. **Keys:** `python scripts/generate_keys.py` (copy to .env)
3. **Config:** `cp .env.example .env` (edit with DATABASE_URL, keys)
4. **Init:** `python scripts/init_db.py` (migrations + admin user)
5. **Run:** `uvicorn api:app --reload`
6. **Docs:** http://localhost:8000/docs

### Database Migrations

- **Create:** `alembic revision --autogenerate -m "description"`
- **Apply:** `alembic upgrade head`
- **Rollback:** `alembic downgrade -1`
- **History:** `alembic history`
- **Status:** `alembic current`

### Testing (Planned)

**Commands:**
- `pytest tests/ -v --cov=src` (all tests with coverage)
- `pytest tests/test_file.py -v` (specific test file)
- `pytest --cov=src --cov-report=html` (HTML coverage report)

**Coverage Goals:** 80%+ unit tests for services, 80%+ integration tests for repositories, 100% API endpoint coverage

---

## Deployment Guide

### Prerequisites

1. **Supabase Project:** Create at https://supabase.com, get transaction pooler URL
2. **Security Keys:** `python scripts/generate_keys.py > keys.txt` (store securely)
3. **Environment:** `cp .env.example .env` (configure all required variables)

### Database Setup

   ```bash
# Run migrations and create admin user
alembic upgrade head
python scripts/create_admin.py

# Verify connection
python -c "from src.database.engine import verify_connection; verify_connection()"
```

### Docker Deployment

```bash
# Build and run
docker build -t enigma-backend:2.0.0 .
docker run -d -p 8000:8000 --env-file .env --name enigma-backend enigma-backend:2.0.0

# Monitor logs
docker logs -f enigma-backend
```

### Production Checklist

- [ ] Generate production encryption keys
- [ ] Configure Supabase transaction pooler
- [ ] Set up environment variables
- [ ] Run database migrations and create admin user
- [ ] Test API health endpoint and JWT authentication
- [ ] Test complete 9-phase workflow
- [ ] Enable HTTPS/TLS and rate limiting
- [ ] Set up monitoring (Prometheus, Grafana) and automated backups
- [ ] Configure CORS for frontend domain
- [ ] Set up error tracking (Sentry)

---

## Performance & Optimization

### PostgreSQL Performance Benefits

**Query Performance:**
- Create application: 5ms (vs 50ms CSV)
- Read application: 2ms (vs 100ms CSV)
- Batch operations: 15ms for 100 records (vs 500ms CSV)
- Indexed queries: O(log n) vs O(n) linear scans

**Scalability:**
- Supports 1M+ applications (vs 10K CSV limit)
- 100-1000 concurrent users (vs 1-5 CSV)
- ACID transactions ensure data integrity
- Native backup/restore with pg_dump/pg_restore

### Optimization Strategies

1. **Connection Pooling:** Supabase transaction pooler with configurable pool_size
2. **Indexing:** Strategic indexes for cycle/status queries, monitored with EXPLAIN ANALYZE
3. **Batch Operations:** `bulk_insert_mappings()` for large datasets, chunked exports
4. **Caching:** Redis caching for cycle info and public API responses

---

## Troubleshooting

### Timezone-Aware DateTime Handling

**CRITICAL:** PostgreSQL `TIMESTAMP(timezone=True)` fields require timezone-aware datetime objects. All datetime operations MUST use `datetime.now(timezone.utc)` instead of `datetime.utcnow()`.

**Affected Files:**
- `src/database/repositories/admin_repository.py` (session validation, cleanup)
- `src/services/admin_auth.py` (JWT token generation)
- `api.py` (date range comparisons, cycle creation)

**Example:**
```python
from datetime import datetime, timezone

# ❌ WRONG - Naive datetime (no timezone info)
expires_at = datetime.utcnow() + timedelta(hours=24)

# ✅ CORRECT - Timezone-aware datetime
expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
```

**Error if not followed:**
```
TypeError: can't compare offset-naive and offset-aware datetimes
```

### Database Connection Issues

**Test Connection:**
```bash
python -c "from src.database.engine import verify_connection; print(verify_connection())"
```

**Check DATABASE_URL Format:**
```bash
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
# Use Supabase transaction pooler (port 6543)
```

### Migration Problems

**Check Migration Status:**
```bash
alembic current    # Current version
alembic history    # Migration history
```

**Reset Migrations (CAUTION - Destroys Data):**
```bash
alembic downgrade base && alembic upgrade head
```

### Import/Dependency Errors

**Reinstall Dependencies:**
```bash
uv sync
```

**Check Python Path:**
```bash
python -c "import sys; print('\n'.join(sys.path))"
```

### Invalid Fernet Key

**Regenerate Keys:**
```bash
python scripts/generate_keys.py
# Update .env with new ENCRYPTION_KEY
```

### Session Management

**Clean Expired Sessions:**
```python
from src.database.engine import get_db_context
from src.services.admin_auth import AdminAuthService

with get_db_context() as db:
    auth = AdminAuthService(db)
    count = auth.cleanup_expired_sessions()
    print(f'Cleaned up {count} sessions')
```

---

## Changelog

### v2.3.0 (2025-10-19) - Phase 2 Bias Monitoring System

**MAJOR RELEASE: Real-Time Bias Monitoring for Live Interviews**

- **Added**: Complete bias monitoring system with 6 new database tables (`live_transcripts`, `live_bias_analysis`, `live_nudges`, `bias_flags`, `drift_metrics`, `admin_bias_history`)
- **Added**: LangGraph workflow orchestration for bias detection pipeline (Audio → STT → Analysis → Nudge → Action)
- **Added**: STTService with OpenAI Whisper API integration for real-time speech-to-text transcription (10-15s audio chunks)
- **Added**: BiasDetectionService using GPT-5-mini LLM with context-aware prompts and structured JSON output
- **Added**: NudgeService with graduated response logic (Info → Warning → Block) and automatic escalation
- **Added**: Strike tracking system with admin status management (Active → Warned → Suspended → Banned)
- **Added**: Bias flag system for critical incidents requiring super_admin review
- **Added**: Comprehensive repositories for bias monitoring (Transcript, BiasAnalysis, Nudge, BiasFlag, DriftMetrics, AdminBiasHistory)
- **Added**: Real-time WebSocket support for audio streaming and nudge delivery (implementation pending frontend integration)
- **Changed**: Updated BIAS_DETECTION_MODEL from gpt-4o-mini to **gpt-5-mini** for improved performance
- **Removed**: Removed unsupported parameters (temperature, max_tokens/max_completion_tokens) for GPT-5 series compatibility
- **Added**: New configuration variables for bias monitoring (thresholds, strike limits, STT settings)
- **Added**: Alembic migration `add_bias_monitoring_tables` for database schema updates
- **Impact**: Enables real-time monitoring of evaluator behavior during live interviews with automatic bias detection and graduated intervention

**Configuration:**
- `ENABLE_BIAS_MONITORING=true` - Enable/disable bias monitoring
- `BIAS_DETECTION_MODEL=gpt-5-mini` - LLM model for bias detection
- `NUDGE_THRESHOLD_LOW=0.3` - Confidence threshold for info nudges
- `NUDGE_THRESHOLD_MEDIUM=0.6` - Confidence threshold for warnings
- `NUDGE_THRESHOLD_HIGH=0.85` - Confidence threshold for blocking
- `STRIKE_LIMIT_PER_INTERVIEW=3` - Auto-block after 3 strikes in single interview
- `STRIKE_LIMIT_PER_CYCLE=5` - Suspension after 5 strikes in cycle
- `STRIKE_RESET_DAYS=90` - Strike reset after 90 days clean record
- `STT_CHUNK_DURATION_SECONDS=10` - Audio buffer duration
- `TRANSCRIPT_RETENTION_DAYS=365` - Transcript storage retention

**Location**:
- Services: `src/services/bias_monitoring_workflow.py`, `src/services/bias_detection_service.py`, `src/services/nudge_service.py`, `src/services/stt_service.py`
- Repositories: `src/database/repositories/transcript_repository.py`, `src/database/repositories/bias_repository.py`
- Models: `src/database/models.py` (6 new tables + enums)
- Schemas: `src/models/schemas.py` (bias monitoring Pydantic models)
- Config: `src/config/settings.py` (bias monitoring settings)

### v2.2.0 (2025-10-19) - Virtual Interviews & Admin UX
- **Added**: Virtual interview feature with WebRTC for real-time video/audio, managed via a new `interviews` table, repository, and dedicated API endpoints (`/admin/interviews/...`).
- **Added**: WebSocket signaling server (`/ws/interview/{interview_id}`) to facilitate peer-to-peer WebRTC connections.
- **Improved**: Streamlined interview scheduling by removing the manual "Meeting Link" input. The backend now automatically generates the correct internal interview link upon creation.
- **Improved**: The admin interviews page now displays a comprehensive list of all interviews from cycles in the `selection`, `published`, and `completed` phases.
- **Fixed**: Resolved a bug where the admin "Join Interview" button was incorrectly disabled by aligning its join logic with the student dashboard (checking only status and time window).
- **Added**: Admins can now delete scheduled interviews via the UI.
- **Added**: A "Manage Interviews" link was added to the admin dashboard for quick access.

### v2.1.0 (2025-10-14) - Student Accounts & Google OAuth
- **Added**: Student authentication tables (`student_accounts`, `oauth_identities`, `student_sessions`, `student_auth_states`) with new Alembic migration `20251014_0000_add_student_accounts`.
- **Added**: Google OAuth (OIDC + PKCE) login flow issuing HttpOnly student sessions with `/auth/student/google/start`, `/auth/student/google/callback`, `/auth/student/logout`, and `/auth/student/me` endpoints.
- **Updated**: Application submission now requires authenticated student sessions; email derives from Google profile and backend enforces one application per cycle per student.
- **Added**: Student-linked application retrieval via `/auth/student/me` to power the new student dashboard experience.
- **Config**: Introduced new environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_BASE`, and `STUDENT_SESSION_TTL_HOURS`.

### v2.0.5 (2025-10-13) - Critical Workflow & Results Display Fixes
- **Fixed**: Hash chain `chain_id` changed from `String(50)` to `Integer` with `autoincrement=True` to resolve NULL constraint violations during hash chain entry creation (`models.py:451`).
- **Added**: Alembic migration `20251013_2200_e2354a7dd801` to alter `hash_chain` table schema with proper sequence generation.
- **Fixed**: Selection phase now correctly updates both `final_scores` AND `applications` tables with SELECTED/NOT_SELECTED status, ensuring proper workflow synchronization (`phase_manager.py:448-480`).
- **Fixed**: Publish phase no longer overwrites selection decisions - `final_scores.status` now preserves SELECTED/NOT_SELECTED instead of being overwritten to PUBLISHED (`phase_manager.py:557-570`).
- **Added**: `status` field to `ResultsResponse` API schema to expose selection decision (SELECTED/NOT_SELECTED/PUBLISHED) to frontend (`api.py:86,348`).
- **Impact**: Complete end-to-end workflow now functions correctly from submission through published results, with proper status tracking and visibility.
- **Location**: `src/database/models.py`, `src/services/phase_manager.py`, `api.py`, `alembic/versions/20251013_2200_e2354a7dd801_*.py`

### v2.0.4 (2025-10-13) - Automated LLM Processing
- **Added**: Internal Worker/Judge LLM execution triggered via `POST /admin/cycles/{id}/processing`, eliminating manual JSONL upload loops.
- **Updated**: `BatchProcessingService` now instantiates SQLAlchemy models for `worker_results`, `judge_results`, and `final_scores` with full audit logging.
- **Added**: Admin UI exposes "Run LLM Evaluation" actions for Batch Prep and Processing phases.
- **Retained**: JSONL export/import endpoints remain for optional external pipelines.

### v2.0.3 (2025-10-12) - Status & Audit Improvements
- **Improved**: `/applications/{id}` now returns normalized status values, phase-aware guidance, and anonymized IDs when present.
- **Aligned**: Audit logging helpers map to valid `AuditActionEnum` values to prevent enum errors during submissions.
- **Updated**: Cycle seat tracking helpers return the updated record, ensuring admin dashboards can reflect live availability.

### v2.0.2 (2025-10-12) - Critical Bug Fixes
- **Fixed**: Added missing `db.commit()` in `get_db()` function (`engine.py:88`). This critical fix ensures all database transactions are properly committed instead of being rolled back when sessions close.
- **Fixed**: Added missing `closed_by` parameter to `close_cycle` endpoint (`api.py:669`). Now properly tracks which admin closed each admission cycle.
- **Improved**: Enhanced datetime handling in `create_cycle` and `update_cycle` endpoints. Pydantic-parsed datetime objects are now properly converted to timezone-aware datetimes without unnecessary string manipulation.
- **Enhanced**: New admission cycles are now automatically opened (`is_open=True`) when created, improving UX by eliminating manual open step.
- **Location**: `src/database/engine.py`, `api.py`

### v2.0.1 (2025-01-12) - Admin Portal & Phase Management
- **Added**: Complete admin portal with JWT authentication, admission cycle CRUD, and 9-phase workflow management.
- **Added**: Comprehensive API endpoints for cycle management (`/admin/cycles/*`).
- **Added**: Session management with automatic cleanup of expired tokens.
- **Security**: Implemented JWT Bearer token authentication for all admin operations with bcrypt password hashing.

### v2.0.0 (2024-12-15) - PostgreSQL Migration
- **Migration**: Migrated from CSV-based storage to PostgreSQL for ACID compliance and scalability.
- **Added**: 14 normalized tables with proper relationships, indexes, and constraints.
- **Added**: Repository pattern for clean data access layer separation.
- **Performance**: 10-100x performance improvements for read/write operations.

---

**Document Version:** 2.0.5
**Maintainer:** ENIGMA Development Team

## Additional Resources

- **Alembic:** https://alembic.sqlalchemy.org/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **Supabase:** https://supabase.com/docs/guides/database
- **Fernet:** https://cryptography.io/en/latest/fernet/
- **FastAPI Security:** https://fastapi.tiangolo.com/tutorial/security/
