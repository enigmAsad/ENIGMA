# ENIGMA Backend - Complete Technical Documentation

**Version:** 1.1.0
**Last Updated:** 2025-10-12
**Python Version:** 3.12+
**Status:** Phase 1 Complete + Admin Portal Integrated

---

## Table of Contents

1.  [Executive Summary](#executive-summary)
2.  [System Architecture](#system-architecture)
3.  [Core Components](#core-components)
4.  [Data Models & Schemas](#data-models--schemas)
5.  [API Reference](#api-reference)
6.  [LLM Integration](#llm-integration)
7.  [Security Architecture](#security-architecture)
8.  [Data Flow & State Machine](#data-flow--state-machine)
9.  [Configuration Management](#configuration-management)
10. [Development & Testing](#development--testing)
11. [Deployment Guide](#deployment-guide)
12. [Performance & Optimization](#performance--optimization)
13. [Troubleshooting](#troubleshooting)
14. [Known Issues & Limitations](#known-issues--limitations)
15. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### What is ENIGMA Phase 1?

ENIGMA is an **AI-powered blind merit screening system** designed to eliminate bias in university admissions. Phase 1 implements automated evaluation of applications using a two-tier LLM architecture with cryptographic audit trails.

### Key Features

-   **Blind Evaluation**: Complete PII removal before AI processing.
-   **Worker-Judge Architecture**: Dual-tier LLM validation with retry logic.
-   **Cryptographic Audit Trail**: SHA-256 hash chain for tamper detection.
-   **Explainable Decisions**: Detailed breakdowns and justifications for every score.
-   **RESTful API**: FastAPI-based web service for frontend integration.
-   **⭐ Admin Portal**: Complete admission cycle management with JWT authentication.
-   **⭐ Seat Management**: Automatic seat tracking and application control.
-   **⭐ Admission Windows**: Date-based application period enforcement.

### Technology Stack

```
Language:        Python 3.12
Web Framework:   FastAPI 0.109+
AI/ML:           OpenAI GPT-5, GPT-5-mini
Orchestration:   LangGraph 0.0.20+
Validation:      Pydantic v2.5+
Storage:         CSV (atomic writes, thread-safe)
Cryptography:    SHA-256 hash chains
NLP:             spaCy 3.7+ (for PII detection)
```

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENIGMA PHASE 1 BACKEND                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │   FastAPI      │◄────────┤   Frontend     │                  │
│  │   REST API     │         │   (React)      │                  │
│  └────────┬───────┘         └────────────────┘                  │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │      Application Collector & Validator         │             │
│  └────────┬───────────────────────────────────────┘             │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │         Identity Scrubber Engine               │             │
│  └────────┬───────────────────────────────────────┘             │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │           LangGraph Pipeline                   │             │
│  │  ┌────────────────────┐ ┌────────────────────┐ │             │
│  │  │  Worker LLM (GPT-5)│ │ Judge LLM(GPT-5-mini)│ │             │
│  │  └──────────┬─────────┘ └──────────┬─────────┘ │             │
│  │             ▼                      │           │             │
│  │       ┌─────┴─────┐        ┌───────┴───────┐   │             │
│  │       │Evaluation │        │ Validation    │   │             │
│  │       └─────┬─────┘        └───────┬───────┘   │             │
│  │             │                      │           │             │
│  │             └─────────►┌───────────┴──┐◄───────┘             │
│  │                        │ Decision Gate │                      │
│  │                        └───┬────────┬──┘                      │
│  │           (Retry < 3) No │        │ Yes (Approved)            │
│  │                          ▼        ▼                           │
│  │                    (Feedback) Final Score                     │
│  └──────────────────────────┬───────────────────────────────────┘             │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────┐            │
│  │     Hash Chain Generator & Other Services      │            │
│  │  (Audit Trail, Notifications, CSV Storage)     │            │
│  └────────────────────────────────────────────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── src/
│   ├── main.py              # CLI entry point
│   ├── config/settings.py   # Pydantic settings management
│   ├── models/schemas.py    # Pydantic data models
│   ├── services/            # Core business logic
│   │   ├── application_collector.py
│   │   ├── identity_scrubber.py
│   │   ├── worker_llm.py
│   │   ├── judge_llm.py
│   │   ├── hash_chain.py
│   │   └── admin_auth.py    # ⭐ NEW: JWT authentication
│   ├── orchestration/phase1_pipeline.py # LangGraph state machine
│   └── utils/
│       ├── csv_handler.py   # Atomic CSV operations
│       └── logger.py        # Structured logging
├── api.py                   # FastAPI REST endpoints
├── create_admin.py          # ⭐ NEW: CLI tool to create admin users
├── prompts/                 # LLM prompt templates
├── data/                    # CSV storage (created on init)
└── pyproject.toml           # Dependencies
```

---

## Core Components

### 1. Application Collector (`src/services/application_collector.py`)
**Purpose:** Validates and persists raw application submissions using Pydantic schemas and atomic CSV writes. Generates a unique `application_id`.

### 2. Identity Scrubber (`src/services/identity_scrubber.py`)
**Purpose:** Removes all PII before LLM processing.
-   **Process:** Applies 8+ regex and NLP patterns to remove names, emails, phones, locations, etc.
-   **Output:** Creates an `anonymized.csv` for processing and `identity_mapping.csv` to link anonymized data back to PII.
-   **⭐ Security Note:** The identity mapping currently uses Base64 encoding (insecure). **Production requires Fernet symmetric encryption.**

### 3. Worker LLM (`src/services/worker_llm.py`)
**Purpose:** Evaluates anonymized applications on academic merit using GPT-5.
-   **Model:** `gpt-5` (configurable).
-   **Evaluation Dimensions:**
    -   Academic Performance (30%)
    -   Test Scores (25%)
    -   Achievements (25%)
    -   Essay Quality (20%)
-   **Output:** Generates scores (0-100) for each dimension, a total score, and a detailed explanation, which is then passed to the Judge LLM.

### 4. Judge LLM (`src/services/judge_llm.py`)
**Purpose:** Validates Worker evaluations for bias, quality, and rubric adherence using GPT-5-mini.
-   **Model:** `gpt-5-mini` (cost-efficient).
-   **Validation Criteria:** Checks for bias related to demographics, socioeconomic status, and location. Ensures rubric adherence and high-quality, evidence-based reasoning.
-   **Decision:** Issues an `APPROVED` or `REJECTED` verdict. If rejected, it provides specific, actionable feedback for the Worker LLM's retry attempt.

### 5. Hash Chain Generator (`src/services/hash_chain.py`)
**Purpose:** Creates a tamper-evident cryptographic audit trail for all decisions.
-   **Algorithm:** Sequentially links decisions by hashing the current decision's data with the previous entry's hash (`hash = SHA256(current_data | previous_hash)`).
-   **Security:** Ensures immutability and forward security. Any modification to a past entry breaks the entire chain.
-   **Verification:** The entire chain can be verified for integrity via a CLI command (`python src/main.py verify`).

### 6. Admin Authentication Service (`src/services/admin_auth.py`)
**⭐ NEW: JWT-based authentication for the admin portal.**
-   **Purpose:** Secures admin endpoints and manages administrative user sessions.
-   **Features:**
    -   **Password Hashing:** Uses `bcrypt` for secure password storage.
    -   **JWT Tokens:** Generates and validates HS256 JWT tokens for authenticating API requests.
    -   **Session Management:** Tracks admin sessions in `admin_sessions.csv`.
-   **CLI Tool:** A `create_admin.py` script is provided to create the initial admin user.
-   **FastAPI Integration:** Uses dependency injection (`Depends`) to protect admin routes.

### 7. CSV Handler (`src/utils/csv_handler.py`)
**Purpose:** Provides thread-safe, atomic CSV operations for all data persistence.
-   **Atomic Writes:** Uses a temp file -> `fsync` -> atomic rename pattern to prevent data corruption during writes.
-   **Thread Safety:** Employs file-level locks to manage concurrent access.
-   **Scalability:** Suitable for the MVP phase (<10,000 applications) but is a bottleneck at scale due to O(n) reads and writes.
-   **Managed Files:** Handles 11 CSV files, including `applications.csv`, `admin_users.csv`, `admission_cycles.csv`, and `hash_chain.csv`.

### 8. Phase 1 Pipeline (`src/orchestration/phase1_pipeline.py`)
**Purpose:** Orchestrates the end-to-end evaluation workflow using a LangGraph state machine.
-   **State Machine Nodes:**
    1.  `scrub_identity`: Removes PII.
    2.  `worker_evaluation`: First-pass merit scoring.
    3.  `judge_review`: Validates the worker's output.
    4.  `decision_gate`: Routes for retry, approval, or failure.
    5.  `final_scoring`: Aggregates the final approved scores.
    6.  `hash_generation`: Creates the audit trail entry.
    7.  `send_notification`: Emails the applicant.
    8.  `completed` / `failed`: Terminal states.
-   **Retry Loop:** If the Judge rejects an evaluation, the pipeline routes back to the Worker up to 2 more times (3 total attempts), each time providing the Judge's feedback.

---

## Data Models & Schemas

The system uses Pydantic for robust data validation. Key models include:
-   **Core Models:** `Application`, `AnonymizedApplication`, `WorkerResult`, `JudgeResult`, `FinalScore`, `HashChainEntry`.
-   **Admin Models:** `AdminUser`, `AdminSession`, `AdmissionCycle`.
-   **State & Enums:** `PipelineState`, `ApplicationStatus`, `JudgeDecision`.

### Key Schema Examples

```python
# Raw application submitted by an applicant
class Application(BaseModel):
    application_id: str
    timestamp: datetime
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    gpa: float = Field(..., ge=0.0, le=4.0)
    test_scores: Dict[str, float]
    essay: str = Field(..., min_length=100, max_length=5000)
    achievements: str = Field(..., min_length=10, max_length=3000)
    status: ApplicationStatus

# Worker LLM evaluation output
class WorkerResult(BaseModel):
    result_id: str
    anonymized_id: str
    attempt_number: int
    academic_score: float = Field(..., ge=0.0, le=100.0)
    test_score: float = Field(..., ge=0.0, le=100.0)
    achievement_score: float = Field(..., ge=0.0, le=100.0)
    essay_score: float = Field(..., ge=0.0, le=100.0)
    total_score: float
    explanation: str
    reasoning: Dict[str, str]
```

---

## API Reference

The system exposes a RESTful API via FastAPI.

### Public Endpoints

-   `GET /health`: System health check.
-   `POST /applications`: Submit a new application. This is now controlled by admin-defined admission cycles.
-   `GET /applications/{application_id}`: Get the processing status of an application.
-   `GET /results/{anonymized_id}`: Get the final, detailed evaluation results.
-   `POST /verify`: Verify the hash of a single decision.
-   `GET /verify/chain`: Verify the integrity of the entire hash chain.
-   `GET /dashboard/stats`: Get high-level statistics on application processing.
-   `GET /admission/info`: Get details about the currently active admission cycle.
-   `GET /admission/status`: A simple boolean check if admissions are open.

### Admin Endpoints (Protected by JWT)

A full suite of admin endpoints under `/admin/` allows for managing the system.

-   **Authentication (`/admin/auth/`)**
    -   `POST /login`: Authenticate and receive a JWT.
    -   `POST /logout`: Invalidate the current session.
    -   `GET /me`: Get the current admin's user details.
-   **Admission Cycles (`/admin/cycles/`)**
    -   `POST /`: Create a new admission cycle (defines start/end dates, total seats).
    -   `GET /`: List all cycles.
    -   `GET /{cycle_id}`: Get a specific cycle's details.
    -   `PUT /{cycle_id}`: Update a cycle.
    -   `PUT /{cycle_id}/open`: Activate a cycle for admissions (and close any other active one).
    -   `PUT /{cycle_id}/close`: Manually close an active cycle.

---

## LLM Integration

-   **Models:** Uses `gpt-5` for the Worker (high-quality evaluation) and `gpt-5-mini` for the Judge (cost-efficient validation).
-   **Retry Logic:** Implements exponential backoff for transient API errors (e.g., rate limits).
-   **Prompt Management:** Prompts are loaded from the `./prompts/` directory and cached on startup.
-   **Response Parsing:** Expects JSON output from the LLMs and can parse it from within markdown code blocks.

---

## Security Architecture

### Key Security Measures

-   **PII Protection:** Identity scrubber anonymizes all application data before it reaches any LLM.
-   **Audit Trail:** The cryptographic hash chain ensures the integrity and non-repudiation of all evaluation decisions.
-   **Input Validation:** Pydantic models enforce strict type, length, and range constraints on all incoming data.
-   **Admin Authentication:** JWT-based authentication protects all administrative endpoints.

### ⚠️ Critical Security Vulnerabilities (MVP)

1.  **Identity Mapping Not Encrypted:** PII mapping is stored in Base64. **This is not encryption.** Must be replaced with Fernet symmetric encryption before production.
2.  **No Rate Limiting:** Login and application submission endpoints are vulnerable to DoS and brute-force attacks.
3.  **Permissive CORS:** Default configuration allows broad access. Must be restricted to the frontend domain in production.

---

## Data Flow & State Machine

The application lifecycle is managed by a LangGraph state machine.

### State Machine Diagram

```
START
  ↓
scrub_identity
  ↓
worker_evaluation ──────┐
  ↓                     │ (retry with feedback)
judge_review            │
  ↓                     │
decision_gate ◄─────────┘
  │ (rejected, attempt < 3)
  │
  ├─(approved)→ final_scoring → hash_generation → send_notification → END (completed)
  │
  └─(rejected, attempt >= 3)→ END (failed)
```

### State Transitions

An application moves through states like `SUBMITTED`, `SCRUBBING`, `WORKER_EVALUATION`, `JUDGE_REVIEW`, and finally `COMPLETED` or `FAILED`. The retry loop between `WORKER_EVALUATION` and `JUDGE_REVIEW` can execute up to 3 times.

---

## Configuration Management

-   **Environment Variables:** All configuration is managed via a `.env` file and loaded by Pydantic's `BaseSettings`.
-   **Key Variables:** `OPENAI_API_KEY`, `WORKER_MODEL`, `JUDGE_MODEL`, `MAX_RETRY_ATTEMPTS`, `JWT_SECRET_KEY`.
-   **Initialization:** The `python src/main.py init` command validates the configuration and creates necessary directories and files.

---

## Development & Testing

### Setup & Running

```bash
# Install dependencies
uv sync
python -m spacy download en_core_web_sm

# Configure environment
cp .env.example .env
# (Edit .env with your keys)

# Initialize system
python src/main.py init

# Run API server
uvicorn api:app --reload
```

### Testing Strategy (Planned)

The project plans for a comprehensive testing suite using `pytest`.
-   **Unit Tests:** For individual components like the identity scrubber and hash chain logic.
-   **Integration Tests:** For the end-to-end pipeline and API endpoints, using mocked LLM responses.
-   **Coverage Goal:** >80% for critical paths.

---

## Deployment Guide

### Docker Deployment

A `Dockerfile` is provided for containerizing the application.
```bash
# Build and Run
docker build -t enigma-backend .
docker run -d -p 8000:8000 --env-file .env enigma-backend
```

### Cloud Deployment (AWS)

A scalable cloud architecture is recommended for production, using services like:
-   **Compute:** AWS ECS Fargate for container orchestration.
-   **Database:** Amazon RDS for PostgreSQL (to replace CSV).
-   **Storage:** S3 for backups and audit logs.
-   **Security:** AWS Secrets Manager for API keys and encryption keys.

---

## Performance & Optimization

### Current Bottlenecks

1.  **Sequential Processing:** Applications are processed one by one.
2.  **LLM API Latency:** Network calls to OpenAI are the slowest part of the process.
3.  **CSV Storage:** O(n) reads and writes make it unsuitable for large volumes.

### Optimization Strategies

-   **Parallel Processing:** Use a `ThreadPoolExecutor` to process applications concurrently.
-   **Database Migration:** Replace CSV with PostgreSQL to enable indexing and transactional writes.
-   **Async Operations:** Convert blocking I/O calls (like LLM requests) to be asynchronous.

---

## Troubleshooting

-   **`OpenAI API key not configured`**: Ensure `OPENAI_API_KEY` is set correctly in `.env`.
-   **`Rate limit exceeded`**: The system will auto-retry with exponential backoff. If persistent, check your OpenAI plan limits.
-   **`CSV file locked`**: Ensure no other process (like Excel) has the data files open.
-   **`Hash chain verification failed`**: **Do not manually edit the CSV files.** This indicates data tampering or corruption.

---

## Known Issues & Limitations

-   **CRITICAL: Identity Mapping Not Encrypted:** PII is not securely stored.
-   **HIGH: No Rate Limiting:** Endpoints are vulnerable to abuse.
-   **HIGH: CSV Storage Inefficiency:** The data layer is not scalable.
-   **MEDIUM: No Failed Notification Retries:** If an email fails to send, it is not tried again.

---

## Future Enhancements

-   **Phase 1.5 (Security & Stability):** Implement Fernet encryption, add comprehensive testing, and set up monitoring/alerting.
-   **Phase 2 (Scalability):** Migrate to PostgreSQL, introduce an async task queue (Celery + Redis), and enable horizontal scaling.
-   **Phase 3 (Features):** Add a full admin dashboard UI, real-time updates via WebSockets, and advanced analytics.
-   **Phase 4 (Advanced AI):** Explore fine-tuned models, build an explainability dashboard, and implement automated bias auditing across cohorts.

---

## Changelog

### v1.1.0 (2025-10-12) - Admin Portal Release

**⭐ NEW: Complete Admin Portal Integration**

-   **Backend:** Added a robust `AdminAuthService` with bcrypt password hashing and JWT session management. New Pydantic models (`AdminUser`, `AdmissionCycle`) and CSV files (`admin_users.csv`, `admission_cycles.csv`) were created to support this.
-   **API:** Introduced 13 new endpoints for admin authentication and admission cycle management. The public `/applications` endpoint is now gated by the active admission cycle's status, dates, and available seats.
-   **CLI:** Added `create_admin.py` to bootstrap the first administrative user.
-   **Features:** Admins can now create, open, and close admission cycles, enforcing application windows and seat limits.

### v1.0.0 (2025-10-11) - Initial Phase 1 Release

-   Initial release of the blind AI evaluation system, including the Worker-Judge architecture, identity scrubbing, cryptographic hash chain, and email notifications.

---
**Document Version:** 1.1.0
**Maintainer:** ENIGMA Development Team
