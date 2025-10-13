# ENIGMA Backend - Technical Documentation

**Version:** 2.0.4
**Last Updated:** 2025-10-13
**Python Version:** 3.12+
**Status:** Production Ready

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

### Key Features

- **Blind Evaluation**: Complete PII removal with Fernet encryption
- **9-Phase Workflow**: Structured admission cycle management
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
Orchestration:   LangGraph 0.0.20+
Validation:      Pydantic v2.5+
Encryption:      Fernet (cryptography 41.0+)
Authentication:  JWT (pyjwt 2.8+)
Password Hash:   bcrypt 4.1+
NLP:             spaCy 3.7+ (for PII detection)
```

---

## System Architecture

ENIGMA uses a layered architecture with FastAPI serving as the web framework, PostgreSQL as the database, and a service-oriented design for business logic.

### Architecture Overview

```
FastAPI (REST API + JWT Auth)
       ↓
Repository Layer (Data Access)
  ApplicationRepo | AdminRepo | BatchRepo | AuditRepo
       ↓
PostgreSQL Database (14 Tables)
       ↓
Services Layer (Business Logic)
  IdentityScrubber | PhaseManager | BatchProcessor | AdminAuth
       ↓
LangGraph Pipeline (Optional - Real-time LLM)
```

### Key Layers

**Web Layer:** FastAPI with JWT authentication and Pydantic validation
**Data Layer:** Repository pattern with SQLAlchemy ORM
**Service Layer:** Core business logic for admissions workflow
**Database:** PostgreSQL with 14 normalized tables and proper indexing

---

## Core Components

### Database Engine (`src/database/engine.py`)
Manages PostgreSQL connection pooling and session lifecycle with SQLAlchemy 2.0, QueuePool, and Supabase transaction pooler support.

### Repository Pattern (`src/database/repositories/`)
Clean data access layer with CRUD operations:

- `ApplicationRepository`: Application lifecycle, anonymization, metrics
- `AdminRepository`: Admin users, sessions, admission cycles, phase transitions
- `BatchRepository`: Batch runs, LLM results, final scores
- `AuditRepository`: Audit logs, hash chain management

### Identity Scrubber (`src/services/identity_scrubber.py`)
Removes PII and encrypts identity mappings using Fernet encryption. Process: fetch → scrub → anonymize → encrypt → audit.

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

ENIGMA uses a normalized PostgreSQL schema with 14 tables, proper relationships, indexes, and constraints.

### Core Tables (10)

1. **`applications`** - Raw student submissions with PII (name, email, phone, address, GPA, test scores, essay, achievements)
2. **`anonymized_applications`** - PII-scrubbed data for LLM processing (GPA, test scores, scrubbed essay/achievements)
3. **`identity_mapping`** - Encrypted PII storage using Fernet (links anonymized to original applications)
4. **`deterministic_metrics`** - Pre-computed metrics (test average, academic score, percentile rank)
5. **`batch_runs`** - LLM batch processing jobs (input/output paths, status, record counts)
6. **`worker_results`** - Worker LLM evaluation results (academic/test/achievement/essay scores, explanations)
7. **`judge_results`** - Judge LLM validation results (decisions, confidence scores, bias detection)
8. **`final_scores`** - Aggregated scores with selection status (final score, LLM score, selection status)

### Admin & Audit Tables (4)

9. **`admin_users`** - Admin authentication (username, email, password hash, role, activity status)
10. **`admin_sessions`** - JWT session management (token, expiry, IP tracking, revocation status)
11. **`admission_cycles`** - Admission cycle management (phase, dates, seat counts, selection results)
   - **IMPORTANT:** `created_by` field references `admin_users.admin_id` (format: "ADM_XXXXXXXX"), NOT username
12. **`audit_logs`** - Comprehensive audit trail (entity actions, actor, hash chain, timestamps)
13. **`selection_logs`** - Selection process records (criteria, cutoff scores, execution details)

### Key Relationships

```
admission_cycles (1:N) → applications (1:1) → anonymized_applications
anonymized_applications (1:1) → identity_mapping
anonymized_applications (1:N) → worker_results (1:N) → judge_results
anonymized_applications (1:1) → final_scores
applications (1:1) → deterministic_metrics
batch_runs (1:N) → worker_results, judge_results
admin_users (1:N) → admin_sessions
admin_users (1:N) → admission_cycles (via created_by → admin_id)
admission_cycles (1:N) → selection_logs
audit_logs (hash chain across all entities)
```

---

## Data Models & Schemas

ENIGMA uses Pydantic for API validation and SQLAlchemy for ORM mapping.

### Key Enums

**AdmissionPhaseEnum:** SUBMISSION | FROZEN | PREPROCESSING | BATCH_PREP | PROCESSING | SCORED | SELECTION | PUBLISHED | COMPLETED

**ApplicationStatusEnum:** SUBMITTED | FINALIZED | PREPROCESSING | BATCH_READY | PROCESSING | SCORED | SELECTED | NOT_SELECTED | PUBLISHED

**AdminRoleEnum:** admin | super_admin | auditor

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
- `OPENAI_API_KEY` - OpenAI API key for LLM integration

**Optional:**
- `DATABASE_POOL_SIZE` - Connection pool size (default: 20)
- `ADMIN_TOKEN_EXPIRY_HOURS` - JWT token expiry (default: 24)
- `WORKER_MODEL` - Worker LLM model (default: gpt-5)
- `JUDGE_MODEL` - Judge LLM model (default: gpt-5-mini)
- `BATCH_EXPORT_DIR` - Directory for JSONL exports (default: ./batch_export)

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

**Document Version:** 2.0.4
**Maintainer:** ENIGMA Development Team

## Additional Resources

- **Alembic:** https://alembic.sqlalchemy.org/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **Supabase:** https://supabase.com/docs/guides/database
- **Fernet:** https://cryptography.io/en/latest/fernet/
- **FastAPI Security:** https://fastapi.tiangolo.com/tutorial/security/
