# ENIGMA MVP - Implementation-Only Specification

## Scope
- Standalone admissions portal with two-phase selection
- Phase 1: AI merit screening (blind evaluation)
- Phase 2: AI-monitored live interviews (bias monitoring focuses on evaluators, not applicants)
- Lightweight blockchain-inspired audit trail for integrity

## System Architecture

### Frontend
- Landing page: ENIGMA mission, methodology, trust signals
- Application form: GPA, test scores, essay, achievements
- Interview scheduler and live room: standardized questions, RTC-based live session
- COI declaration form: simple consent/declaration prior to interview (no automated checks)
- Evaluator nudge UI: soft alerts for biased language; hard flags for policy violations
- Evaluator dashboard: live interview console, digital rubric, justification fields
- Results viewer: scores, breakdown, explanations, verification hash
- Public fairness dashboard: aggregated fairness and bias-detection metrics
- Verification portal: validate decision integrity via hash chain

### Backend
- Application collector: form handler → CSV storage
- Identity scrubbing engine: strip PII, assign anonymized IDs
- Phase 1 batch pipeline (Python + LangChain/LangGraph)
  - Worker LLM evaluation
  - Judge LLM validation
  - Retry logic with feedback
  - Merit score aggregation
- Scheduling service: slot management, reminders, session links (manual ops acceptable)
- COI declaration intake: persist evaluator/applicant declarations for each session (manual review; no automated checks)
- Evaluator management system: assignments, intake of scores and justifications
- Bias monitoring engine
  - Streaming STT for live sessions
  - Real-time LLM analysis of evaluator utterances and justifications vs. transcripts
  - Nudge/flag pipeline: thresholds for soft nudges vs. hard policy violations; UI signals
  - Statistical checks: inter-rater agreement, outliers, consistency
  - Drift monitoring across sessions and evaluators; longitudinal metrics
  - Flagging and re-assignment workflow
- Fairness policy engine: DSL for fairness rules; schema validation for rubrics and decisions
- Hash chain generator: SHA-256 based tamper-evident logging
- Email notification system: confirmation, shortlist, final results
- Appeal handler: inbox intake, review queue

### Data Layer (CSV + Hash Chain)
- applications.csv: raw applicant data
- anonymized.csv: identity-scrubbed records with anonymized IDs
- phase1_worker_results.csv: worker outputs
- phase1_judge_results.csv: judge decisions
- phase1_final_scores.csv: merit results and explanations
- live_sessions.csv: session metadata and scheduling
- live_transcripts.csv: streaming STT transcripts with timestamps and speaker turns
- rtc_events.csv: join/leave, network, and moderation events
- evaluator_assignments.csv: session-to-evaluator mapping
- evaluator_scores.csv: rubric scores + written justifications
- live_bias_analysis.csv: real-time bias analysis outputs (flags, evidence, reasoning)
- schedule.csv: interview slot definitions and bookings
- coi_declarations.csv: evaluator/applicant COI declarations per session
- consent_ledger.csv: consent records and retention acknowledgments
- live_nudges.csv: soft alerts and hard flags emitted during sessions
- overrides.csv: manual overrides with actor, reason, and linkage to audit
- re_review_queue.csv: items queued for re-evaluation
- drift_metrics.csv: inter-rater and evaluator drift aggregates
- bias_flags.csv: incidents with explanations and actions
- phase2_final_scores.csv: validated interview scores post-correction
- final_scores.csv: combined Phase 1 + Phase 2
- audit_log.csv: full audit trail
- hash_chain.csv: decision hashes

### AI/ML Components
- Phase 1
  - Worker LLM: merit scoring and explanations
  - Judge LLM: bias/quality validation and approval/reject
  - Identity scrubber: rule-based PII removal
- Phase 2
  - Streaming STT: real-time transcription for live sessions; tuned for Urdu/English and regional accents
  - Bias detection LLM: real-time analysis of evaluator utterances and justifications with transcript context; localized prompts
  - Statistical validation: inter-rater, outliers, demographic parity checks
  - Hash generation: cryptographic proof for decisions

### Integrations
- Email service: transactional messages
- LLM APIs: Claude Batch (Phase 1), GPT-5-nano/Haiku (Phase 2)
- Streaming STT API: OpenAI Realtime/Whisper, Deepgram, or equivalent
- RTC provider: WebRTC (self-hosted) or 3rd-party (Daily/Agora/Twilio)
- Hosting: Vercel/Netlify (frontend), Python cloud function (batch)
- Storage: transcripts and session metadata; no video storage
- Localization: prompt bundles for Urdu/English; bias lexicon tuned to local context

## Functional Requirements

### Roles
- Applicant: submit application and attend live interview; complete COI declaration; view results and explanations; appeal
- Human Evaluator: conduct live interviews; score via rubric; write justifications
- Operator: run batch jobs; manage prompts; recruit evaluators; review flags; handle appeals
- Public Auditor: view fairness dashboard; verify decision hashes

### Lifecycle
- Phase 1: AI merit screening
  - Collect applications
  - Scrub identities and assign anonymized IDs
  - Run worker evaluation → score and explanation
  - Run judge validation → pass or reject; retry if needed
  - Rank, generate explanations, update hash chain
- Phase 2: Human interviews with AI monitoring
  - Schedule and conduct live interviews
  - Capture simple COI declarations prior to session (manual; no automated checks)
  - Assign to evaluators; enforce written justifications
  - Stream real-time transcription during session (localized)
  - Real-time LLM monitoring of evaluator utterances and justifications against transcripts and rubric (localized prompts)
  - Deliver evaluator nudges for biased language; escalate to hard flags on policy violations
  - Statistical checks for consistency and outliers
  - Track inter-rater drift across sessions and evaluators; surface for oversight
  - Flag biased evaluations; reassign for blind re-review as needed
  - Combine validated interview scores with Phase 1
  - Update hash chain and audit logs
- Notifications: confirmations, shortlist, final results with verification link
- Appeals: intake, review, resolution tracking

### Merit and Interview Rubrics
- Phase 1 (merit): academics, tests, achievements, essay quality
- Phase 2 (interview): communication, critical thinking, motivation/fit
- Exclusions: name, gender, appearance, accent, personal connections
- Monitoring focus: evaluator bias referencing protected attributes or irrelevant factors

### Audit Trail
- Decision record persisted and hashed using SHA-256
- Public verification via hash chain validation
- Integrity breaks detectable on any post-hoc changes

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
- Frontend: application form, interview scheduler and live interview room, COI declaration form, evaluator dashboard with nudge UI, results viewer, public dashboard, verification portal
- Backend: CSV-based data layer, batch pipelines for Phase 1 and Phase 2, evaluator management, bias monitoring engine, hash chain, email notifications, appeals intake
- Policy & Prompts: fairness policy DSL, schema files for rubrics/decisions, Worker and Judge prompts; localized bias analysis prompts
- Documentation: setup, runbooks, prompts, data schemas, API keys/integrations
