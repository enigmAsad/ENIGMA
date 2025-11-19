# ENIGMA – AI-Powered Blind Admissions Platform

An end-to-end admissions platform that combines blind merit screening, real-time interview monitoring, and cryptographic audit trails to deliver transparent, bias-resistant admissions decisions.

## Table of Contents
- [Overview](#overview)
- [Feature Highlights](#feature-highlights)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Configuration](#environment-configuration)
- [Nine-Phase Admissions Workflow](#nine-phase-admissions-workflow)
- [Key Modules](#key-modules)
- [Working with Data](#working-with-data)
- [Running the Platform](#running-the-platform)
- [Testing & Quality](#testing--quality)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview
ENIGMA (Equitable National Intelligence for Governance, Merit & Accountability) is a modular two-tier platform:
- **Backend (`/backend`)** – FastAPI services orchestrating a nine-phase admissions lifecycle, LLM-driven evaluation, encrypted data handling, and WebSocket channels for live interviews.
- **Frontend (`/frontend`)** – A Next.js 14 application delivering public landing pages, student self-service, admin cycle management, bias-monitoring dashboards, and an integrity verification portal.

The system is designed for high-stakes admissions programs that require demonstrable fairness, detailed explanations, and cryptographic evidence of integrity.

## Feature Highlights
- **Blind Application Processing** – Automated identity scrubbing and anonymized IDs ensure merit-only evaluation.
- **Dual LLM Evaluation** – Worker/Judge large-language-model pair with retry logic for consistent scoring and explanations.
- **Nine-Phase Workflow** – Structured REST endpoints guide admissions from submission through publication and archival.
- **Real-Time Interview Monitoring** – WebSocket audio streaming, speech-to-text chunking, bias detection, and automated nudges.
- **Bias Governance Dashboards** – Admin UI for reviewing incidents, tracking evaluator strike histories, and enforcing suspensions.
- **Cryptographic Audit Trail** – SHA-256 hash chains, public verification portal, and tamper detection across decisions.
- **Student Self-Service** – Google OAuth with PKCE, application submission, status tracking, interview scheduling, and results.
- **Admin Operations Suite** – Cycle creation, phase transitions, batch exports/imports, LLM orchestration, and shortlisting tools.

## System Architecture
- **Frontend:** Next.js App Router, React Server Components, client-side role-aware hooks, Tailwind-style utility classes, lucide-react iconography.
- **Backend:** FastAPI modular routers, SQLAlchemy ORM, Alembic migrations, LangGraph orchestration, OpenAI GPT-5 models, Postgres persistence.
- **Real-Time Channels:** WebSockets for interview audio ingestion (`/ws/interview/{id}/audio`) and nudge delivery (`/ws/interview/{id}/nudges`).
- **Data Security:** Fernet-encrypted PII vault, hashed audit log, JWT-secured admin sessions, secure cookies for student OAuth.
- **Batch Processing:** JSONL exports for offline evaluation, batch tracking, and deterministic preprocessing of metrics.

```text
frontend/                # Next.js 14 web client
  src/app                # App Router routes for public, student, admin, verification
  src/components         # Reusable UI: forms, dashboards, modals, nudge overlays
  src/hooks              # Auth, audio streaming, admin guard hooks
  src/lib                # API clients (admin, student, public) with PKCE helpers

backend/                 # FastAPI services and orchestration
  src/api/routers        # Public, student, admin, interview, bias, websocket routers
  src/services           # Identity scrubbing, worker/judge LLMs, bias monitoring workflow
  src/database           # SQLAlchemy models, repositories, engine
  src/config             # Pydantic settings & env management
  prompts/               # LLM prompts and rubric
  batch_exports/         # JSONL files for batch evaluations
  data/                  # CSV exports / transcripts (secured)
```

## Technology Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, uvicorn, OpenAI SDK, LangChain/LangGraph, spaCy, WebSockets.
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind-inspired styling, lucide-react, Web Audio API.
- **Infrastructure:** PostgreSQL (Supabase compatible), Fernet encryption, JWT authentication, SMTP email integration.
- **Tooling:** `uv` for Python environment management, `pytest`/`mypy`/`black`, ESLint, PostCSS.

## Getting Started

### Prerequisites
- Python **3.12.x**
- Node.js **18.x** or newer (matching Next.js requirements)
- PostgreSQL database (local or hosted)
- [uv](https://github.com/astral-sh/uv) (recommended) or `pip`/`venv`
- npm (or pnpm/yarn) for the frontend workspace

Clone the repository and navigate into the project root:

```bash
git clone https://github.com/<org>/<repo>.git enigma
cd enigma
```

### Backend Setup
```bash
cd backend

# Create and activate a virtual environment (via uv)
uv venv --python 3.12
source .venv/bin/activate       # Windows: .\.venv\Scripts\activate

# Install dependencies
uv sync
python -m spacy download en_core_web_sm

# Configure environment
cp .env.example .env            # create and edit with your secrets

# Initialise database schema
alembic upgrade head

# Optional utilities
python scripts/generate_keys.py # Generates Fernet & JWT secrets
python scripts/create_admin.py  # Bootstrap admin credentials

# Run FastAPI with reload
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

By default the API is served at `http://localhost:8000/api`.

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure runtime environment
cp .env.local.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000/api
# NEXT_PUBLIC_WS_URL=ws://localhost:8000/api    # optional; auto-derived if omitted

# Start the Next.js dev server
npm run dev
```

The web client runs at `http://localhost:3000`.

## Environment Configuration

### Backend `.env`
| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-5 worker/judge/bias models | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `ENCRYPTION_KEY` | Base64 Fernet key for PII encryption | ✅ |
| `JWT_SECRET` | 256-bit secret for admin JWTs | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for student login | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `GOOGLE_OAUTH_REDIRECT_BASE` | Public base URL used to build OAuth redirect URIs | ✅ |
| `WORKER_MODEL` | OpenAI model name for worker LLM (default `gpt-5`) | |
| `JUDGE_MODEL` | OpenAI model name for judge LLM (default `gpt-5-mini`) | |
| `BIAS_DETECTION_MODEL` | Model for bias monitoring workflow | |
| `EMAIL_SMTP_HOST` / `EMAIL_FROM` / `EMAIL_PASSWORD` | SMTP configuration for notifications | ⚠️ optional |
| `LOG_LEVEL` | Logging level (`INFO`, `DEBUG`, etc.) | |

All path settings (e.g., `PROMPT_DIR`, `LOG_DIR`) are auto-created if missing.

### Frontend `.env.local`
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Base URL for the FastAPI gateway (e.g., `https://api.example.com/api`) |
| `NEXT_PUBLIC_WS_URL` | Optional explicit WebSocket root (falls back to API URL with ws/wss) |

## Nine-Phase Admissions Workflow

| Phase | Purpose | Primary Endpoint(s) |
|-------|---------|---------------------|
| 1. Submission | Students submit applications while cycle is open | `POST /api/applications` |
| 2. Freeze Cycle | Lock submissions and finalise roster | `POST /api/admin/cycles/{id}/freeze` |
| 3. Preprocessing | Deterministic scoring + identity scrubbing | `POST /api/admin/cycles/{id}/preprocess` |
| 4. Batch Prep | Export anonymised JSONL for worker LLM | `POST /api/admin/cycles/{id}/export` |
| 5. LLM Processing | Run worker/judge pipeline (internal or external) | `POST /api/admin/cycles/{id}/processing` |
| 6. Import Scores | Persist batch results, compute final scores | `POST /api/admin/batch/{batch_id}/import` |
| 7. Selection | Shortlist + final selection incorporating interviews | `POST /api/admin/cycles/{id}/select`, `/final-select` |
| 8. Publish | Release results to student portal and email | `POST /api/admin/cycles/{id}/publish` |
| 9. Complete | Archive cycle, freeze modifications | `POST /api/admin/cycles/{id}/complete` |

Each transition is guarded by the `PhaseManager` service, enforcing invariants and logging actions.

## Key Modules
- **Identity Scrubbing:** `src/services/identity_scrubber.py` – strips PII and produces anonymised IDs before evaluation.
- **Worker/Judge LLMs:** `src/services/worker_llm.py`, `src/services/judge_llm.py` – orchestrate OpenAI prompts, retries, and scoring aggregation.
- **Bias Monitoring Workflow:** `src/services/bias_monitoring_workflow.py` – LangGraph pipeline from STT transcripts to recommended nudges and flags.
- **Hash Chain Generator:** `src/services/hash_chain.py` – creates tamper-evident SHA-256 links for every decision.
- **Admin Repositories:** `src/database/repositories` – domain-specific data access: applications, interviews, bias flags, batches.
- **Frontend Auth Hooks:** `src/hooks/useStudentAuth.tsx`, `src/hooks/useAdminAuth.ts` – manage Google OAuth/PKCE and JWT-based admin sessions.
- **Real-Time Interview UI:** `src/app/interview/[interviewId]/page.tsx`, `src/components/NudgeOverlay.tsx` – integrates Web Audio capture, WebSocket streaming, and bias nudges.

## Working with Data
- **PostgreSQL** stores canonical records for applications, admissions cycles, interviews, bias artefacts, and hash chains.
- **`backend/data/`** holds CSV exports, transcripts, and audit artefacts (ensure 600 permissions in production).
- **`backend/batch_exports/`** contains JSONL payloads for offline LLM processing.
- **`backend/logs/`** captures application logs (`enigma.log`). Configure log path via `.env`.

## Running the Platform
1. Bring up FastAPI (`uvicorn api:app --reload`).
2. Start Next.js (`npm run dev`).
3. Visit:
   - `http://localhost:3000/` – public landing page.
   - `http://localhost:3000/student/login` – Google OAuth student portal.
   - `http://localhost:3000/admin/login` – admin console (JWT-bearing).
   - `http://localhost:3000/verify` – hash verification portal.

## Testing & Quality
- **Backend**
  - Unit/Integration tests: `pytest`
  - Coverage: `pytest --cov=src --cov-report=html`
  - Type checking: `mypy src/`
  - Formatting: `black src/`, `isort src/`
- **Frontend**
  - Linting (optional during CI): `npm run lint`
  - Type checking: `npm run type-check` (configure `tsc --noEmit`)

## Troubleshooting
- **API Connectivity:** `python src/main.py test-connection`
- **LLM Credentials:** `python -c "import os; print(os.getenv('OPENAI_API_KEY'))"`
- **Bias Monitoring:** Ensure `NEXT_PUBLIC_WS_URL` or `NEXT_PUBLIC_API_URL` resolves to a WSS endpoint when behind HTTPS.
- **Database Migrations:** `alembic current`, `alembic upgrade head`, `alembic downgrade -1`
- **CSV Corruption:** `python src/main.py verify-data` and `restore --date YYYY-MM-DD`

## Contributing
This repository currently follows an internal workflow. If contributing:
- Create feature branches from `main`.
- Follow Conventional Commits (`feat:`, `fix:`, `docs:` …).
- Run backend tests & linters plus frontend linting before opening a PR.
- Attach screenshots for UI-facing changes and describe API impacts.

## License
Proprietary – ENIGMA Project. All rights reserved.
