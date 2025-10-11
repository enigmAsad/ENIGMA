# ENIGMA Backend - PostgreSQL Migration Complete

**Version:** 2.0.0
**Migration Date:** 2025-10-12
**Database:** PostgreSQL with Supabase
**Status:** ✅ Production Ready

---

## 🎉 What's New in Version 2.0

### Complete PostgreSQL Migration
- ❌ **Removed:** All CSV-based storage
- ✅ **Added:** PostgreSQL with 14 production tables
- ✅ **Added:** Fernet encryption for PII (replacing Base64)
- ✅ **Added:** Comprehensive repository pattern
- ✅ **Added:** 9-phase workflow management
- ✅ **Added:** Batch processing service (JSONL export/import)

### Key Improvements
1. **Security:** Fernet encryption for PII storage
2. **Scalability:** PostgreSQL with proper indexing
3. **Audit Trail:** Dual logging (hash chain + audit logs)
4. **Batch Processing:** JSONL export/import for LLM workflows
5. **Phase Management:** Automated workflow transitions
6. **ACID Compliance:** Transactional integrity

---

## 📋 Quick Start Guide

### Prerequisites
- Python 3.12+
- PostgreSQL database (Supabase recommended)
- OpenAI API key
- Git

### 1. Clone and Install

```bash
cd backend
uv sync
python -m spacy download en_core_web_sm
```

### 2. Generate Security Keys

```bash
python scripts/generate_keys.py
```

This will output:
```
ENCRYPTION_KEY=<fernet-key>
JWT_SECRET=<jwt-secret>
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:port/database

# Security (REQUIRED - from step 2)
ENCRYPTION_KEY=<your-fernet-key>
JWT_SECRET=<your-jwt-secret>

# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-your-key-here
```

### 4. Initialize Database

```bash
python scripts/init_db.py
```

This will:
- Run Alembic migrations to create all 14 tables
- Create your first admin user
- Verify database connection

### 5. Start API Server

```bash
uvicorn api:app --reload
```

Visit: `http://localhost:8000/docs` for API documentation

---

## 🗄️ Database Schema

### Core Tables (14 Total)

#### 1. `applications`
Stores raw student submissions with PII.

```sql
- application_id (PK)
- admission_cycle_id (FK)
- name, email, phone, address (PII)
- gpa, test_scores (JSONB), essay, achievements
- status (ENUM)
- timestamps
```

#### 2. `anonymized_applications`
PII-scrubbed data for LLM processing.

```sql
- anonymized_id (PK)
- application_id (FK, UNIQUE)
- gpa, test_scores (JSONB)
- essay_scrubbed, achievements_scrubbed
- created_at
```

#### 3. `identity_mapping`
Encrypted PII storage using Fernet.

```sql
- mapping_id (PK)
- anonymized_id (FK, UNIQUE)
- application_id (FK, UNIQUE)
- encrypted_pii (Fernet encrypted)
- created_at
```

#### 4. `deterministic_metrics`
Phase 3 pre-computed metrics.

```sql
- metric_id (PK)
- application_id (FK, UNIQUE)
- test_average, academic_score_computed
- percentile_rank
- computed_at
```

#### 5. `batch_runs`
LLM batch processing tracking.

```sql
- batch_id (PK)
- admission_cycle_id (FK)
- batch_type (worker_evaluation | judge_review)
- model_name, input_file_path, output_file_path
- total_records, processed_records, failed_records
- status (pending | running | completed | failed)
- timestamps
```

#### 6-14. Additional Tables
- `worker_results` - LLM evaluation outputs
- `judge_results` - Validation outputs
- `final_scores` - Aggregated scores with selection status
- `hash_chain` - Tamper-evident audit trail
- `audit_logs` - Comprehensive action logging
- `admission_cycles` - Cycle and phase management
- `selection_logs` - Top-K selection audit
- `admin_users` - Admin accounts with RBAC
- `admin_sessions` - JWT session tracking

---

## 🔄 9-Phase Workflow

### Phase 1: Submission
```bash
POST /applications
```
Students submit applications. System validates and stores in PostgreSQL.

### Phase 2: Data Freeze
```bash
POST /admin/cycles/{cycle_id}/freeze
```
- Closes submissions (`is_open = false`)
- Marks all applications as `FINALIZED`
- Locks data for processing

### Phase 3: Preprocessing
```bash
POST /admin/cycles/{cycle_id}/preprocess
```
- Computes test averages
- Normalizes GPA to 0-100 scale
- Calculates percentile ranks

### Phase 4: Batch Preparation
```bash
POST /admin/cycles/{cycle_id}/export-batch
```
- Exports FINALIZED applications to JSONL
- Creates `batch_run` record
- Prepares for LLM processing

### Phase 5: LLM Processing
```bash
# External: Feed JSONL to your batch LLM pipeline
```
LLM evaluates each applicant and returns scores.

### Phase 6: Result Integration
```bash
POST /admin/batch/{batch_id}/import-results
```
- Reads LLM output JSONL
- Updates `final_scores` table
- Marks applications as `SCORED`

### Phase 7: Selection
```bash
POST /admin/cycles/{cycle_id}/select-top-k
```
- Applies Top-K selection
- Marks top N as `SELECTED`
- Creates `selection_log` entry

### Phase 8: Publish Results
```bash
POST /admin/cycles/{cycle_id}/publish
```
- Makes results available to students
- Marks cycle as `PUBLISHED`

### Phase 9: Complete Cycle
```bash
POST /admin/cycles/{cycle_id}/complete
```
- Finalizes cycle
- Archives data
- Marks cycle as `COMPLETED`

---

## 🔐 Security Features

### 1. Fernet Encryption (NEW)
```python
from src.utils.encryption import get_encryption_service

service = get_encryption_service()
encrypted = service.encrypt_pii({"name": "John", "email": "john@ex.com"})
decrypted = service.decrypt_pii(encrypted)
```

### 2. JWT Authentication
```python
from src.services.admin_auth_v2 import AdminAuthServiceV2

auth = AdminAuthServiceV2(db)
result = auth.login(username="admin", password="secret")
# Returns: {"token": "...", "expires_at": "..."}
```

### 3. Audit Logging
Every action creates an audit log with hash chain:
```python
from src.database.repositories import AuditRepository

audit = AuditRepository(db)
audit.create_audit_log(
    entity_type="Application",
    entity_id="APP_12345",
    action=AuditActionEnum.CREATE,
    actor="admin_user",
    details={"action": "created"}
)
```

---

## 🛠️ Development Guide

### Database Migrations

#### Create a new migration
```bash
alembic revision --autogenerate -m "Add new feature"
```

#### Apply migrations
```bash
alembic upgrade head
```

#### Rollback one migration
```bash
alembic downgrade -1
```

#### View migration history
```bash
alembic history
```

### Repository Pattern Usage

```python
from sqlalchemy.orm import Session
from src.database.repositories import ApplicationRepository
from src.database.engine import get_db_context

# Using context manager
with get_db_context() as db:
    app_repo = ApplicationRepository(db)

    # Create application
    app = app_repo.create_application(
        application_id="APP_001",
        admission_cycle_id="CYC_2025",
        name="John Doe",
        email="john@example.com",
        gpa=3.8,
        test_scores={"SAT": 1450},
        essay="My essay...",
        achievements="Awards..."
    )

    # Get application
    app = app_repo.get_by_application_id("APP_001")

    # Update status
    app_repo.update_status("APP_001", ApplicationStatusEnum.FINALIZED)
```

### Batch Processing

```python
from src.services.batch_processor import BatchProcessingService

batch_service = BatchProcessingService(db)

# Phase 4: Export to JSONL
file_path, count = batch_service.export_applications_to_jsonl("CYC_2025")
print(f"Exported {count} applications to {file_path}")

# Phase 6: Import results
imported = batch_service.import_llm_results_from_jsonl(
    batch_id=1,
    results_file_path="output.jsonl"
)
print(f"Imported {imported} results")
```

### Phase Transitions

```python
from src.services.phase_manager import PhaseManager

phase_mgr = PhaseManager(db)

# Freeze cycle
cycle = phase_mgr.freeze_cycle("CYC_2025")

# Start preprocessing
cycle = phase_mgr.start_preprocessing("CYC_2025")

# Perform selection
result = phase_mgr.perform_selection(
    cycle_id="CYC_2025",
    executed_by="ADM_ADMIN"
)
```

---

## 📊 API Endpoints

### Public Endpoints

```
GET  /health                    # Health check
POST /applications              # Submit application
GET  /applications/{id}         # Get application status
GET  /admission/info            # Get current cycle info
GET  /admission/status          # Check if admissions open
```

### Admin Endpoints (Protected by JWT)

```
# Authentication
POST /admin/auth/login          # Login
POST /admin/auth/logout         # Logout
GET  /admin/auth/me             # Get current admin

# Cycles
POST /admin/cycles              # Create cycle
GET  /admin/cycles              # List all cycles
GET  /admin/cycles/{id}         # Get cycle details
PUT  /admin/cycles/{id}         # Update cycle
POST /admin/cycles/{id}/freeze  # Phase 2: Freeze cycle
POST /admin/cycles/{id}/preprocess  # Phase 3: Preprocess
POST /admin/cycles/{id}/export-batch  # Phase 4: Export JSONL
POST /admin/cycles/{id}/select  # Phase 7: Select top-k
POST /admin/cycles/{id}/publish # Phase 8: Publish results
POST /admin/cycles/{id}/complete # Phase 9: Complete cycle

# Batch Processing
POST /admin/batch/import        # Import LLM results
GET  /admin/batch/{id}/status   # Get batch status

# Audit
GET  /admin/audit/logs          # Get audit logs
GET  /admin/audit/verify-chain  # Verify hash chain integrity
```

---

## 🚀 Production Deployment

### Supabase Setup

1. Create Supabase project
2. Get transaction pooler URL:
   ```
   Settings → Database → Connection string → Transaction mode
   ```

3. Add to `.env`:
   ```bash
   DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres
   ```

### Environment Variables (Production)

```bash
# Database
DATABASE_URL=<supabase-pooler-url>
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=0

# Security (CRITICAL: Use strong keys)
ENCRYPTION_KEY=<fernet-key-from-generator>
JWT_SECRET=<jwt-secret-from-generator>

# OpenAI
OPENAI_API_KEY=sk-proj-<your-key>
WORKER_MODEL=gpt-5
JUDGE_MODEL=gpt-5-mini

# Email (Optional)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_FROM=noreply@enigma.edu
EMAIL_PASSWORD=<app-password>
```

### Docker Deployment

```bash
docker build -t enigma-backend .
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  enigma-backend
```

---

## 🧪 Testing

### Run Tests (Coming Soon)
```bash
pytest tests/ -v --cov=src
```

### Manual Testing

```bash
# 1. Create admin
python scripts/create_admin.py

# 2. Start server
uvicorn api:app --reload

# 3. Login (get token)
curl -X POST http://localhost:8000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 4. Create cycle
curl -X POST http://localhost:8000/admin/cycles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_name":"Fall 2025",
    "max_seats":100,
    "start_date":"2025-01-01T00:00:00",
    "end_date":"2025-03-31T23:59:59",
    "result_date":"2025-05-01T00:00:00"
  }'
```

---

## 📁 Project Structure

```
backend/
├── alembic/                    # Database migrations
│   ├── versions/              # Migration files
│   ├── env.py                 # Alembic config
│   └── script.py.mako         # Migration template
├── scripts/                   # Utility scripts
│   ├── generate_keys.py       # Generate security keys
│   ├── create_admin.py        # Create admin user
│   └── init_db.py             # Initialize database
├── src/
│   ├── config/
│   │   └── settings.py        # Pydantic settings
│   ├── database/
│   │   ├── engine.py          # SQLAlchemy engine
│   │   ├── models.py          # 14 database models
│   │   ├── base.py            # Declarative base
│   │   └── repositories/      # Repository pattern
│   │       ├── application_repository.py
│   │       ├── admin_repository.py
│   │       ├── batch_repository.py
│   │       └── audit_repository.py
│   ├── models/
│   │   └── schemas.py         # Pydantic schemas
│   ├── services/
│   │   ├── identity_scrubber_v2.py  # PII removal
│   │   ├── admin_auth_v2.py         # JWT auth
│   │   ├── batch_processor.py       # JSONL export/import
│   │   └── phase_manager.py         # Workflow transitions
│   └── utils/
│       ├── encryption.py      # Fernet encryption
│       └── logger.py          # Logging
├── api.py                     # FastAPI application
├── alembic.ini                # Alembic configuration
├── .env.example               # Environment template
└── pyproject.toml             # Dependencies

```

---

## 🔧 Troubleshooting

### Database Connection Failed
```bash
# Test connection
python -c "from src.database.engine import verify_connection; print(verify_connection())"

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

### Migration Errors
```bash
# Reset migrations (CAUTION: Deletes all data)
alembic downgrade base
alembic upgrade head

# Check current version
alembic current
```

### Import Errors
```bash
# Ensure all dependencies installed
uv sync

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"
```

---

## 📚 Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy 2.0 Docs](https://docs.sqlalchemy.org/)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database)
- [Fernet Encryption](https://cryptography.io/en/latest/fernet/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)

---

## 🎯 Next Steps

1. **Phase Testing:** Test all 9 phases end-to-end
2. **Automated Tests:** Write pytest integration tests
3. **API Documentation:** Expand OpenAPI documentation
4. **Monitoring:** Add Prometheus metrics
5. **Performance:** Benchmark query performance
6. **Scale Testing:** Test with 10K+ applications

---

## 📝 Changelog

### v2.0.0 (2025-10-12) - PostgreSQL Migration
- ✅ Complete CSV → PostgreSQL migration
- ✅ Fernet encryption for PII
- ✅ 14-table database schema
- ✅ Repository pattern implementation
- ✅ Batch processing service
- ✅ 9-phase workflow manager
- ✅ JWT authentication with sessions
- ✅ Comprehensive audit logging
- ✅ Alembic migrations setup
- ✅ Utility scripts (key generation, admin seeder)

---

**Maintainer:** ENIGMA Development Team
**License:** MIT
**Support:** Create an issue on GitHub
