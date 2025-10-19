# ENIGMA System Plan (Production-Ready)

**Status:** Phase 1 ✅ Complete (PostgreSQL + Student Accounts) | Phase 2 ✅ Complete (Live Interviews + Bias Monitoring)

## Scope
- Standalone admissions portal with two-phase selection
- **Phase 1: AI merit screening (blind evaluation)** ✅ **IMPLEMENTED**
  - PostgreSQL-based backend with 14 normalized tables
  - FastAPI REST API with JWT authentication
  - Admin portal for cycle management
  - 9-phase workflow with batch LLM processing
  - Cryptographic audit trail (SHA-256 hash chain)
- **Phase 2: AI-monitored live interviews** ✅ **IMPLEMENTED**
  - Bias monitoring focuses on evaluators, not applicants
  - Real-time transcription and LLM analysis
  - Evaluator dashboard with nudge system
  
**Student Accounts & SSO (Phase 1.5)** ✅ **IMPLEMENTED**
- Google OAuth (OIDC + PKCE) student login with HttpOnly session cookies
- Enforced one application per admission cycle per student account via service and DB constraints
- Application submission derives contact email from SSO claims; no separate email input
- Preserves anonymization: evaluators continue to see anonymized records only; student identity never enters evaluator context
- Student actions (e.g., application submission) are linked to their account in operational logs while the cryptographic audit trail references anonymized IDs
- Dedicated student dashboard replaces the public ID-based status checker, enabling secure, authenticated application management
- Next Step: Phase 2 live interviews, bias monitoring, and evaluator workflows

## System Architecture

### Frontend (Next.js 15 + React 19 + TypeScript)

**✅ Phase 1 - Implemented:**
- **Landing page**: ENIGMA mission, methodology, trust signals, real-time admission status banner
- **Application form**: GPA, test scores, essay, achievements with comprehensive validation
- **Status checker**: Application tracking with progress indicators
- **Results viewer**: Scores, breakdown, explanations, verification hash (when Phase 1 LLM evaluation completes)
- **Public fairness dashboard**: Aggregated fairness and transparency metrics
- **Verification portal**: Validate decision integrity via hash chain
- **Admin Portal** (JWT-protected):
  - Admin login and authentication
  - Admin dashboard with system overview
  - Admission cycle management (create, open, close cycles)
  - 9-phase workflow controls
  - Application statistics and monitoring

**✅ Phase 2 - Implemented:**
- Interview scheduler and live room (WebRTC)
- Real-time bias monitoring with nudges (info/warning/block)
- Admin interviews page for scheduling/listing and joining sessions

**✅ Accounts & SSO - Implemented (Frontend):**
- Student sign-in with Google (OIDC + PKCE) and HttpOnly session cookies
- Submission flow requires authenticated session; no manual email field
- Student dashboard manages applications (status, results), replacing the public status checker for authenticated users
- Navigation adapts to student/admin roles with contextual actions

### Backend (FastAPI + PostgreSQL + Python 3.12)

**✅ Phase 1 - Implemented:**
- **Application collector**: RESTful API handler → PostgreSQL storage with ACID transactions
- **Admin authentication**: JWT-based authentication with bcrypt password hashing, session management
- **Admission cycle management**: 9-phase workflow with validation gates
  - Phase 1 (SUBMISSION): Accept applications with seat tracking
  - Phase 2 (FROZEN): Freeze cycle and finalize applications
  - Phase 3 (PREPROCESSING): Compute deterministic metrics
  - Phase 4 (BATCH_PREP): Export to JSONL for LLM batch processing
  - Phase 5 (PROCESSING): External LLM batch processing
  - Phase 6 (SCORED): Import LLM results and update scores
  - Phase 7 (SELECTION): Top-K selection based on scores
  - Phase 8 (PUBLISHED): Publish results to applicants
  - Phase 9 (COMPLETED): Archive cycle
- **Identity scrubbing engine**: Fernet encryption for PII, anonymized ID assignment
- **Phase 1 batch pipeline**: JSONL export/import for LLM processing
  - Worker LLM evaluation (planned: OpenAI Batch API)
  - Judge LLM validation (planned: quality and bias checks)
  - Structured JSON output with scores and explanations
  - Merit score aggregation and ranking
- **Repository pattern**: Clean data access layer (Application, Admin, Batch, Audit repositories)
- **Hash chain generator**: SHA-256 based tamper-evident audit trail
- **Public APIs**: Application submission, status checking, results viewing, verification
- **Admin APIs**: Cycle CRUD, phase transitions, batch management, audit logs

**✅ Phase 2 - Implemented:**
- WebSocket signaling + audio streaming for STT
- Real-time LLM bias analysis and graduated nudge/flag pipeline
- Drift metrics and admin bias history

Remaining (Future): COI declarations, evaluator management/assignments, email notifications, appeals

**✅ Accounts & SSO - Implemented (Backend):**
- Student OIDC (Google) login endpoint verifies `email_verified`
- Identity bindings (`provider`, `provider_sub`, `email`) with session issuance stored securely
- Submission endpoint requires student session; derives email from SSO claims
- Enforces one application per cycle per student via DB unique index and service-layer checks
- Maintains strict separation: PII in encrypted stores; evaluators see only anonymized IDs

### Data Layer

**✅ Phase 1 - PostgreSQL Schema (14 Tables):**

**Core Application Tables:**
1. **applications**: Raw student submissions with PII (name, email, GPA, test scores, essay, achievements)
2. **anonymized_applications**: PII-scrubbed data for LLM processing with anonymized IDs
3. **identity_mapping**: Fernet-encrypted PII storage linking anonymized to original IDs
4. **deterministic_metrics**: Pre-computed metrics (test averages, academic scores, percentile ranks)

**LLM Processing Tables:**
5. **batch_runs**: LLM batch processing job metadata (input/output paths, status, record counts)
6. **worker_results**: Worker LLM evaluation outputs (academic/test/achievement/essay scores, explanations)
7. **judge_results**: Judge LLM validation decisions (approve/reject, confidence, bias detection)
8. **final_scores**: Aggregated scores with selection status (final score, LLM score, selection flag)

**Admin & Audit Tables:**
9. **admin_users**: Admin authentication (username, email, password hash, role, activity status)
10. **admin_sessions**: JWT session management (token, expiry, IP tracking, revocation)
11. **admission_cycles**: Admission cycle management (phase, dates, seat counts, open/closed status)
12. **audit_logs**: Comprehensive audit trail (entity actions, actor, hash chain, timestamps)
13. **selection_logs**: Selection process records (criteria, cutoff scores, execution details)

**Relationships:**
- admission_cycles (1:N) → applications (1:1) → anonymized_applications
- **New Flow**: `student_accounts` (1:N) → `applications`
- anonymized_applications (1:1) → identity_mapping
- anonymized_applications (1:N) → worker_results (1:N) → judge_results
- anonymized_applications (1:1) → final_scores
- admin_users (1:N) → admin_sessions, admission_cycles
- Full hash chain linkage across audit_logs

**Data Flow for Evaluation and Results for Phase 1**
- The core data flow is designed to ensure a blind evaluation while allowing results to be securely delivered back to the student.
- **Forward Path (Submission & Evaluation):** `student_accounts` → `applications` → `anonymized_applications` → `final_scores`.
  - An authenticated student submits an `application`.
  - The system creates a corresponding `anonymized_application`, stripping all PII.
  - All evaluation work (worker/judge results) culminates in a `final_score` record linked to the `anonymized_application`.
- **Return Path (Results Display):** `final_scores` → `anonymized_applications` → `applications` → `student_accounts`.
  - The selection decision (`SELECTED`/`NOT_SELECTED`) is stored in the `final_scores` table.
  - When a student views their dashboard, the system uses this reverse linkage to find the relevant decision and display it securely, without ever exposing the student's identity during the evaluation phases.

**✅ Accounts & SSO - New Tables (Implemented):**
- **student_accounts**: Student identity source (primary_email, status, created_at, verified_at)
- **oauth_identities**: `student_id`, `provider`, `provider_sub`, `email`, `email_verified`
- Added `student_id` FK to **applications** with unique index on `(student_id, admission_cycle_id)`

**✅ Phase 2 - Tables (Implemented):**
- **live_transcripts**
- **live_bias_analysis**
- **live_nudges**
- **bias_flags**
- **drift_metrics**
- **admin_bias_history**
- **interview_scores**

### AI/ML Components

**✅ Phase 1 - Implemented:**
- **Identity scrubber**: Fernet-based PII encryption and anonymization
- **Batch LLM pipeline**: JSONL export/import for external LLM processing
  - Worker LLM (planned): GPT-5 for merit scoring and explanations (OpenAI Batch API)
  - Judge LLM (planned): GPT-5-mini for bias/quality validation
  - Structured JSON output with schema validation
- **Hash generation**: SHA-256 cryptographic proof for all decisions
- **Deterministic metrics**: Pre-computed academic scores, test averages, percentile ranks

**✅ Phase 2 - Implemented:**
- **Streaming STT**: Real-time transcription for live sessions
- **Bias detection LLM**: Real-time analysis of evaluator utterances
- **Drift monitoring**: Longitudinal evaluator consistency tracking

### Integrations

**✅ Phase 1 - Implemented:**
- **Database**: PostgreSQL (Supabase) with transaction pooler
- **Backend hosting**: Python 3.12 + FastAPI + Uvicorn (Docker/cloud-ready)
- **Frontend hosting**: Next.js 15 (Vercel/Netlify)
- **LLM APIs** (ready for integration): OpenAI Batch API for Worker/Judge LLMs
- **Security**: JWT authentication, bcrypt password hashing, Fernet encryption

**✅ Phase 2 - Delivered:**
- WebRTC signaling + WebSocket endpoints
- OpenAI Whisper-based STT and GPT-5-mini bias detection
- Transcript storage; no raw audio/video retention
Future: Email service, additional localization

## Functional Requirements

### Roles

**✅ Phase 1 - Implemented:**
- **Applicant**: Submit application, check status, view results and explanations, verify decision hashes
- **Admin**: Manage admission cycles, control 9-phase workflow, monitor applications, review audit logs
- **Public Auditor**: View fairness dashboard, verify decision hashes via hash chain

**✅ Phase 2 - Implemented:**
- **Applicant**: Attend live interviews; receive decisions post-interview
- **Human Evaluator/Admin**: Conduct/manage interviews; monitored with real-time bias nudges and flags

**⏳ Accounts & SSO - In Progress:**
- **Student**: Authenticates via Google. Submits and manages their application(s) through a dedicated dashboard. All actions are linked to their account while preserving the anonymity of the evaluation process.

### Lifecycle

**✅ Phase 1: AI Merit Screening (9-Phase Workflow) - Implemented:**
1. **SUBMISSION**: Applications are collected through an SSO-authenticated public API, enabling verified student submissions with real-time seat availability tracking.
2. **FROZEN**: Admin freezes cycle; all applications marked as FINALIZED
3. **PREPROCESSING**: Compute deterministic metrics (GPA, test averages, percentile ranks)
4. **BATCH_PREP**: Export anonymized applications to JSONL for LLM batch processing
5. **PROCESSING**: External LLM batch processing (OpenAI Batch API ready for integration)
   - Worker LLM: Merit scoring and explanations
   - Judge LLM: Bias/quality validation with approve/reject decisions
6. **SCORED**: Import LLM results; update final_scores table; mark applications as SCORED
7. **SELECTION**: Top-K selection based on final scores; mark as SELECTED/NOT_SELECTED
8. **PUBLISHED**: Publish results to applicants; make available via public API
9. **COMPLETED**: Archive cycle for historical reference

**✅ Phase 2: Human Interviews with AI Monitoring - Implemented:**
- Schedule and conduct live interviews (WebRTC)
- Stream real-time transcription and run live bias analysis
- Deliver nudges (info/warning/block) and create bias flags
- Track drift metrics and admin bias history
- Use interview scores for final selection

**✅ Accounts & SSO - Lifecycle Changes Implemented:**
- **Authenticated Submissions**: Application submission now requires an authenticated student session (via Google). The system enforces a one-application-per-cycle limit per student account.
- **SSO-Derived Identity**: The applicant's email is derived from SSO claims; PII is immediately encrypted and anonymized.
- **Student Dashboard & Results Delivery**: The public ID-based status checker is replaced by a secure student dashboard. When results are published, the system uses the relational link from `final_scores` back to the `student_account` to display decisions and feedback while preserving evaluation anonymity.

**🔄 Additional Features - Planned:**
- **Notifications**: Email confirmations, shortlist, final results with verification link
- **Appeals**: Intake, review queue, resolution tracking

### Merit and Interview Rubrics
- Phase 1 (merit): academics, tests, achievements, essay quality
- Phase 2 (interview): communication, critical thinking, motivation/fit
- Exclusions: name, gender, appearance, accent, personal connections
- Monitoring focus: evaluator bias referencing protected attributes or irrelevant factors

### Audit Trail
 - Decision-critical evaluation events only, recorded under anonymized IDs:
   - evaluation_started, worker_result, judge_result, final_score_committed, selection_decision, results_published
 - Hash-chained integrity with payload digests only (input_hash/output_hash). No raw payloads or PII in audit rows. The chain is anchored to anonymized application IDs only.
 - Database-level audit trail for DML tamper evidence (append-only): table, operation, primary_key, before_hash, after_hash, tx_id, timestamp; periodic root-hash anchoring
 - Public verification via hash chain validation; integrity breaks detectable on any post-hoc changes
 - Operational/auth/session events are excluded from the hash chain (kept in standard logs/metrics if needed)

### Explainability
- Include: Phase 1 score; interview score; final combined score
- Breakdown by rubric categories
- Strengths and areas for improvement
- Bias monitoring status
- Verification hash and appeal instructions

## Evaluation System Architecture

### Phase 1: Worker-Judge
- Orchestrate with LangChain/LangGraph
- Worker produces structured JSON with scores and explanation
- Judge validates for bias adherence and rubric consistency; pass/reject
- Worker retries with feedback when rejected

### Phase 2: STT + LLM + Statistics
- Stream live transcription from RTC session
- For each evaluator submission
  - Inputs: scores, written justification, live transcript, rubric
  - LLM outputs: bias_detected, bias_types, evidence quotes, severity, justification-transcript mismatch, recommendation, nudge_or_flag
- Statistical layer
  - Inter-rater agreement checks
  - Outlier detection and pattern analysis
  - Drift monitoring across evaluators and over time
  - Demographic parity checks (where applicable)
- Actions
  - Nudge evaluator in-session (soft); raise hard flag on violations
  - Log incident; reassign for blind review when required
  - Remove evaluator from pool if persistent bias; re-review their decisions

### LangGraph State Machine
- APPLICATION_SUBMITTED → IDENTITY_SCRUBBING → PHASE1_WORKER_EVALUATION → PHASE1_JUDGE_REVIEW → DECISION_GATE → PHASE1_RANKING → SHORTLIST_NOTIFICATION → PHASE2_INTERVIEW_SCHEDULING → COI_DECLARATION → EVALUATOR_ASSIGNMENT → LIVE_INTERVIEW → AI_BIAS_MONITORING → OVERSIGHT_REVIEW → BIAS_CORRECTION → FINAL_SCORE_COMBINATION → HASH_CHAIN_GENERATION → FINAL_RANKING → AUDIT_LOGGING → NOTIFICATION → COMPLETED

### Consistency & Reproducibility
- Low-temperature LLM configs; seed control where supported
- Structured outputs with schema validation
- Inter-rater reliability via multi-evaluator design
- Full audit logging and hash-chained decisions

### Privacy & Data Protection
- Strip PII before Phase 1 LLM calls
- Anonymized IDs for evaluators; no demographic info displayed
- Do not store raw audio or video; persist transcripts only
- Consent and retention: capture explicit consent; ledger entries with purpose, scope, and TTL; enforce transcript retention policies
- Separate secure mapping of anonymized IDs to identities
- Plan for migration to self-hosted models for privacy at scale

## Non-Functional Requirements
- Reliability: batch jobs resumable with idempotent steps
- Security: HTTPS, rate limiting, encryption at rest, backups
- Observability: audit logs, bias flags, basic error tracking, analytics
- Localization: STT models and prompts tuned for Urdu/English and regional accents

## Deliverables

**✅ Phase 1 - Delivered:**
- **Frontend** (Next.js 15 + React 19):
  - Landing page with real-time admission status and student-aware CTAs
  - Application form with comprehensive validation and SSO-bound submissions
  - Student dashboard replacing public status checker for authenticated users
  - Results viewer with score breakdowns and secure student context
  - Public fairness dashboard
  - Verification portal for hash validation
  - Admin portal (login, dashboard, cycle management, phase controls)
- **Backend** (FastAPI + PostgreSQL):
  - 14-table normalized PostgreSQL schema + student accounts tables
  - RESTful API with JWT (admin) and Google OAuth sessions (students)
  - Repository pattern for data access
  - 9-phase admission cycle workflow
  - JSONL export/import for batch LLM processing
  - SHA-256 hash chain for audit trail
  - Admin APIs for cycle and application management
- **Documentation**:
  - `BACKEND.md`: Technical specification (v2.1.0)
  - `FRONTEND.md`: Implementation guide (v1.3.0)
  - Database schema and API reference
  - Development and deployment guides

**🔄 Phase 2 - Planned:**
- **Frontend additions**:
  - Interview scheduler and live interview room (RTC)
  - COI declaration form
  - Evaluator dashboard with real-time nudge UI
- **Backend additions**:
  - Evaluator management system
  - Bias monitoring engine with streaming STT
  - Real-time LLM analysis of evaluator utterances
  - Statistical validation (inter-rater, drift monitoring)
  - Email notification system
  - Appeals handling workflow
- **Policy & Prompts**:
  - Fairness policy DSL
  - Worker and Judge LLM prompts
  - Localized bias analysis prompts (Urdu/English)
  - Schema files for rubrics and decisions

---

## Implementation Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend** | ✅ Complete | Next.js 15 + React 19 + TypeScript |
| **Backend Core** | ✅ Complete | FastAPI + PostgreSQL + 9-phase workflow |
| **Admin Portal** | ✅ Complete | JWT auth, cycle management, phase controls |
| **Public APIs** | ✅ Complete | Application submission, status, results, verification |
| **Database** | ✅ Complete | 14 tables, normalized schema, proper indexes |
| **Audit Trail** | ✅ Complete | SHA-256 hash chain, comprehensive audit logs |
| **Phase 1 Pipeline** | 🔧 Integration Ready | JSONL export/import ready for OpenAI Batch API |
| **Phase 2 Interviews** | ✅ Complete | Live interviews, STT, bias monitoring, final selection |
| **Email Notifications** | 🔄 Planned | Confirmation, shortlist, results |
| **Appeals System** | 🔄 Planned | Intake, review, resolution tracking |

**Version:** Backend v2.4.1 | Frontend v1.4.0
**Last Updated:** 2025-10-19
