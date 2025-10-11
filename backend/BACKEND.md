# ENIGMA Phase 1 Backend - Complete Technical Documentation

**Version:** 1.0.0
**Last Updated:** 2025-10-11
**Python Version:** 3.12+
**Status:** Phase 1 Implementation Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Data Models & Schemas](#data-models--schemas)
5. [API Reference](#api-reference)
6. [LLM Integration](#llm-integration)
7. [Security Architecture](#security-architecture)
8. [Data Flow & State Machine](#data-flow--state-machine)
9. [Configuration Management](#configuration-management)
10. [Development Guide](#development-guide)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Guide](#deployment-guide)
13. [Performance Optimization](#performance-optimization)
14. [Troubleshooting](#troubleshooting)
15. [Known Issues & Limitations](#known-issues--limitations)
16. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### What is ENIGMA Phase 1?

ENIGMA is an **AI-powered blind merit screening system** designed to eliminate bias in university admissions. Phase 1 implements automated evaluation of applications using a two-tier LLM architecture with cryptographic audit trails.

### Key Features

- **Blind Evaluation**: Complete PII removal before AI processing
- **Worker-Judge Architecture**: Dual-tier LLM validation with retry logic
- **Cryptographic Audit Trail**: SHA-256 hash chain for tamper detection
- **Explainable Decisions**: Detailed breakdowns and justifications for every score
- **Email Notifications**: Automated applicant communications
- **RESTful API**: FastAPI-based web service for frontend integration

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

### System Metrics

- **Throughput**: ~10-15 applications/minute (sequential processing)
- **Latency**: 30-60s per application (LLM-dependent)
- **Retry Logic**: Up to 3 worker attempts before failure
- **Audit Trail**: 100% tamper-evident with cryptographic verification

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
│  │  (Pydantic validation, CSV persistence)        │             │
│  └────────┬───────────────────────────────────────┘             │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │         Identity Scrubber Engine               │             │
│  │  (Regex + NER PII removal, anonymization)     │             │
│  └────────┬───────────────────────────────────────┘             │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │           LangGraph Pipeline                   │             │
│  │  ┌──────────────────────────────────────────┐ │             │
│  │  │  Worker LLM (GPT-5)                      │ │             │
│  │  │  → Merit evaluation (4 dimensions)       │ │             │
│  │  └──────────┬───────────────────────────────┘ │             │
│  │             ▼                                  │             │
│  │  ┌──────────────────────────────────────────┐ │             │
│  │  │  Judge LLM (GPT-5-mini)                  │ │             │
│  │  │  → Bias detection & validation           │ │             │
│  │  └──────────┬───────────────────────────────┘ │             │
│  │             │                                  │             │
│  │     ┌───────┴────────┐                        │             │
│  │     │  Approved?     │                        │             │
│  │     └───┬────────┬───┘                        │             │
│  │         │ No     │ Yes                        │             │
│  │         ▼        ▼                            │             │
│  │    Retry(3x) Final Score                     │             │
│  └─────────────────┬──────────────────────────────┘             │
│                    ▼                                             │
│  ┌────────────────────────────────────────────────┐             │
│  │     Hash Chain Generator (SHA-256)            │             │
│  │  → Cryptographic audit trail                  │             │
│  └────────┬───────────────────────────────────────┘             │
│           │                                                       │
│           ▼                                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │     Email Notification Service                │             │
│  │  → SMTP delivery to applicants                │             │
│  └────────────────────────────────────────────────┘             │
│                                                                   │
│  ┌────────────────────────────────────────────────┐             │
│  │           CSV Data Layer (Atomic)              │             │
│  │  → Thread-safe writes, file locks             │             │
│  └────────────────────────────────────────────────┘             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Interaction Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ FastAPI  │────▶│  Pipeline│────▶│ Worker   │────▶│  Judge   │
│   API    │     │  Manager │     │   LLM    │     │   LLM    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │
     │                │                  │                │
     ▼                ▼                  ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    CSV Handler (Thread-Safe)                │
│  applications.csv │ anonymized.csv │ worker_results.csv │   │
│  judge_results.csv │ final_scores.csv │ hash_chain.csv │   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Audit Logger                             │
│  audit_log.csv (immutable, append-only)                    │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── main.py                      # CLI entry point
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py              # Pydantic settings management
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py               # Pydantic data models (15+ schemas)
│   ├── services/                    # Core business logic
│   │   ├── __init__.py
│   │   ├── application_collector.py # Application intake & validation
│   │   ├── identity_scrubber.py     # PII removal engine (8 patterns)
│   │   ├── worker_llm.py            # GPT-5 merit evaluator
│   │   ├── judge_llm.py             # GPT-5-mini bias validator
│   │   ├── hash_chain.py            # Cryptographic audit trail
│   │   └── email_service.py         # SMTP notification delivery
│   ├── orchestration/
│   │   ├── __init__.py
│   │   └── phase1_pipeline.py       # LangGraph state machine (9 nodes)
│   └── utils/
│       ├── __init__.py
│       ├── csv_handler.py           # Atomic CSV operations (8 files)
│       └── logger.py                # Structured logging + audit
├── api.py                           # FastAPI REST endpoints (9 routes)
├── prompts/                         # LLM prompt templates
│   ├── worker_prompt.txt            # 150 lines, detailed rubric
│   ├── judge_prompt.txt             # 230 lines, bias detection guide
│   └── rubric.json                  # Structured evaluation criteria
├── data/                            # CSV storage (created on init)
│   ├── applications.csv
│   ├── anonymized.csv
│   ├── identity_mapping.csv         # Encrypted PII mapping
│   ├── phase1_worker_results.csv
│   ├── phase1_judge_results.csv
│   ├── phase1_final_scores.csv
│   ├── audit_log.csv
│   └── hash_chain.csv
├── logs/                            # Application logs
│   └── enigma.log
├── pyproject.toml                   # UV package manager config
├── uv.lock                          # Dependency lock file
├── README.md                        # Setup & usage guide
├── ARCHITECTURE.md                  # System design document
└── BACKEND.md                       # This file
```

---

## Core Components

### 1. Application Collector (`src/services/application_collector.py`)

**Purpose:** Validate and persist raw application submissions.

**Key Responsibilities:**
- Validate incoming application data via Pydantic schemas
- Generate unique application IDs (`APP_{UUID8}`)
- Persist to `applications.csv` with atomic writes
- Trigger audit logging for intake events

**Code Reference:**
```python
class ApplicationCollector:
    def collect_application(self, app_data: Dict[str, Any]) -> Application:
        """Validate and persist application."""
        application = Application(**app_data)  # Pydantic validation
        self.csv_handler.append_application(application)
        self.audit_logger.log_application_submitted(...)
        return application
```

**Validation Rules:**
- Name: 2-200 characters
- Email: Valid email format (EmailStr)
- GPA: 0.0-4.0 scale
- Test scores: Non-empty dict with positive values
- Essay: 100-5000 characters
- Achievements: 10-3000 characters

**Error Handling:**
- Pydantic ValidationError → 400 Bad Request
- Duplicate application_id → Logged, not rejected (idempotent)

---

### 2. Identity Scrubber Engine (`src/services/identity_scrubber.py`)

**Purpose:** Remove all personally identifiable information before LLM processing.

**PII Detection Patterns:**

| Category | Pattern | Replacement |
|----------|---------|-------------|
| **Email** | RFC 5322 regex | `[EMAIL_REDACTED]` |
| **Phone** | International formats | `[PHONE_REDACTED]` |
| **URLs** | HTTP/HTTPS links | `[URL_REDACTED]` |
| **Social Media** | @handles, profile links | `[SOCIAL_MEDIA_REDACTED]` |
| **Institutions** | University/College/School + name | `[INSTITUTION_REDACTED]` |
| **Names** | Context-based (e.g., "My name is X") | `[NAME_REDACTED]` |
| **Locations** | City/State/Country after indicators | `[LOCATION_REDACTED]` |
| **ID Numbers** | SSN, CNIC, passport formats | `[ID_REDACTED]` |

**Anonymization Process:**
1. Generate anonymized ID: `ANON_{timestamp_ms}_{random_6_chars}`
2. Apply all 8 scrubbing patterns to essay and achievements
3. Store scrubbed application in `anonymized.csv`
4. Encrypt PII and store mapping in `identity_mapping.csv`
5. Log scrubbing metrics (redaction counts)

**Code Example:**
```python
def scrub_application(self, application: Application) -> AnonymizedApplication:
    anonymized_id = self.generate_anonymized_id(application.application_id)

    # Apply all scrubbing patterns
    essay_scrubbed = self.scrub_text(application.essay)
    achievements_scrubbed = self.scrub_text(application.achievements)

    # Store identity mapping (encrypted in production)
    self._store_identity_mapping(
        anonymized_id=anonymized_id,
        application_id=application.application_id,
        pii_data={"name": application.name, "email": application.email, ...}
    )

    return AnonymizedApplication(...)
```

**Security Note:**
- **Current Implementation:** Base64 encoding (NOT encryption)
- **Production Requirement:** Use Fernet (symmetric encryption) with 32-byte key
- **Key Storage:** Environment variable or secrets manager (AWS Secrets Manager, HashiCorp Vault)

**Metrics Logged:**
- Total redactions per application
- Redaction breakdown by type
- Processing time

---

### 3. Worker LLM Service (`src/services/worker_llm.py`)

**Purpose:** Evaluate anonymized applications on academic merit using GPT-5.

**Model Configuration:**
```python
Model: gpt-5 (configurable via WORKER_MODEL env var)
API: OpenAI Chat Completions
Note: GPT-5 does NOT support temperature, max_tokens, max_completion_tokens
```

**Evaluation Dimensions:**

| Dimension | Weight | Scale | Description |
|-----------|--------|-------|-------------|
| **Academic Performance** | 30% | 0-100 | GPA, coursework rigor, trajectory |
| **Test Scores** | 25% | 0-100 | Standardized tests (SAT, ACT) |
| **Achievements** | 25% | 0-100 | Awards, leadership, impact |
| **Essay Quality** | 20% | 0-100 | Ideas, reasoning, curiosity |

**Total Score Calculation:**
```python
total = (academic * 0.30) + (test * 0.25) + (achievement * 0.25) + (essay * 0.20)
```

**Prompt Structure (150 lines):**
- System role: University admissions merit evaluator
- Detailed rubric with scoring guides for each dimension
- Explicit bias mitigation rules (6 categories)
- JSON output format specification
- Examples of good vs. biased evaluations

**Response Parsing:**
```python
{
    "academic_score": 82.0,
    "test_score": 85.0,
    "achievement_score": 78.0,
    "essay_score": 80.0,
    "total_score": 81.2,
    "explanation": "The applicant demonstrates strong academic...",
    "reasoning": {
        "academic": "3.6 GPA with consistent performance...",
        "test": "SAT 1380 (89th percentile)...",
        "achievement": "Regional science fair finalist...",
        "essay": "Thoughtful exploration of ethical AI..."
    },
    "rubric_adherence": "Applied scoring guides consistently..."
}
```

**Retry Logic:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 API retries for transient errors (RateLimitError, APITimeoutError)
- Worker evaluation retries: Max 3 attempts (controlled by Judge)

**Validation:**
- Scores in range 0-100 (Pydantic validation)
- Total score within 5 points of weighted average
- All required fields present

**Code Reference:**
```python
def evaluate(
    self,
    application: AnonymizedApplication,
    attempt_number: int = 1,
    judge_feedback: Optional[str] = None
) -> WorkerResult:
    """Evaluate anonymized application with optional retry feedback."""
    prompt = self._build_evaluation_prompt(application, attempt_number, judge_feedback)
    response_text = self._call_llm(prompt)  # With retry logic
    evaluation_data = self._parse_llm_response(response_text)

    # Validate and persist
    worker_result = WorkerResult(**evaluation_data)
    self.csv_handler.append_worker_result(worker_result)

    return worker_result
```

---

### 4. Judge LLM Service (`src/services/judge_llm.py`)

**Purpose:** Validate Worker evaluations for bias, quality, and rubric adherence using GPT-5-mini.

**Model Configuration:**
```python
Model: gpt-5-mini (cost-efficient for validation)
Decision: Binary (APPROVED / REJECTED)
```

**Validation Criteria (4 Categories):**

#### 1. Bias Detection
**Protected Attributes (must be ignored):**
- Demographics: Gender, ethnicity, religion, nationality
- Socioeconomic: Privilege indicators, resource access
- Geographic: Location, institution prestige
- Linguistic: Name patterns, writing style

**Common Bias Patterns Flagged:**
- Demographic assumptions ("from [LOCATION] likely lacked...")
- Privilege bias ("no elite institution affiliations")
- Cultural bias ("essay style is too formal")
- Comparative bias ("not as strong as applicants from...")

#### 2. Rubric Adherence
- Scores aligned with stated criteria
- All 4 dimensions properly evaluated
- Correct weighting (30%, 25%, 25%, 20%)
- Explanations support scores
- Total score calculation accurate (within 5 points)

#### 3. Reasoning Quality
- Specific and evidence-based
- Cites concrete data from application
- Logical and internally consistent
- Balanced (strengths + improvements)
- Fair comparison to standards

#### 4. Consistency
- Component scores align with total
- Explanations match scores
- Balanced tone across dimensions
- Similar achievements scored similarly

**Decision Rules:**
```python
APPROVE if:
    - No bias detected (bias_detected = False)
    - Rubric properly applied
    - Strong reasoning (quality_score >= 75)
    - Internally consistent

REJECT if ANY of:
    - Bias indicators found (even subtle)
    - Poor rubric adherence
    - Weak reasoning (quality_score < 75)
    - Internal inconsistencies
```

**Response Format:**
```json
{
    "decision": "approved",  // or "rejected"
    "bias_detected": false,
    "quality_score": 88,
    "feedback": "Excellent evaluation. Specific, evidence-based...",
    "reasoning": "Thorough, fair, and unbiased. Worker provides specific evidence...",
    "bias_indicators": [],
    "rubric_issues": [],
    "quality_issues": []
}
```

**Feedback for Retries:**
If REJECTED, provides specific, actionable guidance:
```
"The essay score of 65 penalizes writing style ('non-native patterns')
rather than evaluating the quality of ideas. Re-evaluate focusing on
the intellectual content: What arguments does the applicant make?
What insights do they demonstrate? Ignore linguistic fluency."
```

**Code Reference:**
```python
def validate(
    self,
    application: AnonymizedApplication,
    worker_result: WorkerResult
) -> JudgeResult:
    """Validate Worker evaluation for bias and quality."""
    prompt = self._build_validation_prompt(application, worker_result)
    response_text = self._call_llm(prompt)
    validation_data = self._parse_llm_response(response_text)

    decision = JudgeDecision.APPROVED if validation_data["decision"] == "approved" else JudgeDecision.REJECTED

    judge_result = JudgeResult(
        decision=decision,
        bias_detected=validation_data["bias_detected"],
        quality_score=validation_data["quality_score"],
        feedback=validation_data["feedback"],
        reasoning=validation_data["reasoning"],
        ...
    )

    self.csv_handler.append_judge_result(judge_result)
    return judge_result
```

---

### 5. Hash Chain Generator (`src/services/hash_chain.py`)

**Purpose:** Create tamper-evident cryptographic audit trail for all decisions.

**Hash Algorithm:**
```python
def generate_hash(data: Dict[str, Any], previous_hash: str) -> str:
    """Generate SHA-256 hash linking to previous decision."""
    data_json = json.dumps(data, sort_keys=True, default=str)
    hash_input = f"{data_json}|{previous_hash}"
    return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
```

**Chain Structure:**
```
Entry 0: data_hash = SHA256(genesis_data | GENESIS_HASH)
Entry 1: data_hash = SHA256(data_1 | Entry_0.data_hash)
Entry 2: data_hash = SHA256(data_2 | Entry_1.data_hash)
...
```

**Genesis Hash:** `"0" * 64` (for first entry in chain)

**Data Included in Hash:**
- anonymized_id
- final_score (all dimensions)
- explanation
- strengths
- areas_for_improvement
- worker_attempts
- timestamp (ISO format)

**Verification Methods:**

1. **Single Entry Verification:**
```python
def verify_entry(entry: HashChainEntry, previous_entry: Optional[HashChainEntry]) -> bool:
    """Verify a single hash chain entry."""
    expected_previous = previous_entry.data_hash if previous_entry else GENESIS_HASH

    # Check previous hash link
    if entry.previous_hash != expected_previous:
        return False

    # Recalculate hash
    data = json.loads(entry.data_json)
    calculated_hash = self.generate_hash(data, entry.previous_hash)

    # Verify match
    return calculated_hash == entry.data_hash
```

2. **Full Chain Verification:**
```python
def verify_chain(chain: List[HashChainEntry]) -> Dict[str, Any]:
    """Verify integrity of entire hash chain."""
    is_valid = True
    invalid_entries = []

    for i, entry in enumerate(chain):
        previous_entry = chain[i - 1] if i > 0 else None
        if not self.verify_entry(entry, previous_entry):
            is_valid = False
            invalid_entries.append({
                "index": i,
                "chain_id": entry.chain_id,
                "timestamp": entry.timestamp
            })

    return {
        "is_valid": is_valid,
        "chain_length": len(chain),
        "invalid_entries": invalid_entries
    }
```

**Security Properties:**
- **Immutability:** Any modification to past entries breaks the chain
- **Forward Security:** Cannot forge future entries without previous hashes
- **Append-Only:** Only new entries can be added (no updates/deletes)

**CLI Verification:**
```bash
python src/main.py verify
# Output: ✓ Hash chain is VALID (127 entries verified)
```

---

### 6. CSV Handler (`src/utils/csv_handler.py`)

**Purpose:** Thread-safe, atomic CSV operations for data persistence.

**Design Principles:**
1. **Atomicity:** Temp file → fsync → atomic rename
2. **Thread Safety:** File-level locks per CSV
3. **Immutability:** Append-only operations (no updates)
4. **Durability:** fsync before commit

**Atomic Write Pattern:**
```python
def _atomic_write(self, csv_path: Path, rows: List[List[str]], mode: str = 'w'):
    """Atomically write to CSV file using temp file + rename."""
    # Create temp file in same directory (for atomic rename)
    temp_fd, temp_path = tempfile.mkstemp(
        dir=csv_path.parent,
        prefix=f".tmp_{csv_path.name}_"
    )

    try:
        with os.fdopen(temp_fd, 'w', newline='', encoding='utf-8') as temp_file:
            writer = csv.writer(temp_file)

            if mode == 'a' and csv_path.exists():
                # Copy existing content for append mode
                with open(csv_path, 'r') as existing:
                    reader = csv.reader(existing)
                    for row in reader:
                        writer.writerow(row)

            # Write new rows
            writer.writerows(rows)

            # Force write to disk (critical for durability)
            temp_file.flush()
            os.fsync(temp_file.fileno())

        # Atomic rename (platform-specific handling)
        if os.name == 'nt':  # Windows
            if csv_path.exists():
                backup = csv_path.with_suffix('.bak')
                shutil.copy2(csv_path, backup)
                os.replace(temp_path, csv_path)
                backup.unlink()
            else:
                os.replace(temp_path, csv_path)
        else:  # Unix/Linux/macOS
            os.replace(temp_path, csv_path)

    except Exception as e:
        # Cleanup on failure
        if Path(temp_path).exists():
            Path(temp_path).unlink()
        raise
```

**Thread Safety:**
```python
def append_worker_result(self, worker_result: WorkerResult):
    """Append worker result with thread-safe locking."""
    lock = self._get_lock(self.WORKER_RESULTS_CSV)
    with lock:  # Acquire file-specific lock
        csv_path = self._get_csv_path(self.WORKER_RESULTS_CSV)
        row = self._model_to_csv_row(worker_result)
        self._atomic_write(csv_path, [row], mode='a')
```

**CSV Schemas:**

| File | Columns | Purpose |
|------|---------|---------|
| `applications.csv` | application_id, timestamp, name, email, phone, address, gpa, test_scores_json, essay, achievements, status | Raw submissions |
| `anonymized.csv` | anonymized_id, application_id, gpa, test_scores_json, essay_scrubbed, achievements_scrubbed, created_at | PII-removed data |
| `identity_mapping.csv` | anonymized_id, application_id, encrypted_pii, created_at | Reversible mapping |
| `phase1_worker_results.csv` | result_id, anonymized_id, attempt_number, academic_score, test_score, achievement_score, essay_score, total_score, explanation, reasoning_json, rubric_adherence, timestamp, model_used | Worker evaluations |
| `phase1_judge_results.csv` | judge_id, result_id, anonymized_id, worker_result_id, decision, bias_detected, quality_score, feedback, reasoning, timestamp, model_used | Judge validations |
| `phase1_final_scores.csv` | anonymized_id, final_score, academic_score, test_score, achievement_score, essay_score, explanation, strengths_json, areas_for_improvement_json, timestamp, hash, worker_attempts | Final approved scores |
| `audit_log.csv` | log_id, timestamp, entity_type, entity_id, action, actor, details_json, metadata_json, previous_hash, current_hash | Complete audit trail |
| `hash_chain.csv` | chain_id, anonymized_id, decision_type, data_json, data_hash, previous_hash, timestamp | Cryptographic chain |

**Query Operations:**
```python
# Get application by ID (O(n) linear scan)
def get_application_by_id(self, application_id: str) -> Optional[Application]:
    rows = self._read_csv(self.APPLICATIONS_CSV)
    for row in rows:
        if row['application_id'] == application_id:
            return Application(**row)
    return None

# Get all final scores (sorted by score descending)
def get_all_final_scores(self) -> List[FinalScore]:
    rows = self._read_csv(self.FINAL_SCORES_CSV)
    scores = [FinalScore(**row) for row in rows]
    return sorted(scores, key=lambda s: s.final_score, reverse=True)
```

**Performance Characteristics:**
- **Writes:** O(n) for append (must read + write entire file)
- **Reads:** O(n) linear scan (no indexing)
- **Scalability:** Suitable for <10,000 applications
- **Bottleneck:** Full file rewrites on every append

**Future Migration Path:**
- SQLite: Single-machine, ACID transactions
- PostgreSQL: Multi-machine, full SQL capabilities
- Implement indexes for O(1) lookups

---

### 7. Phase 1 Pipeline (`src/orchestration/phase1_pipeline.py`)

**Purpose:** Orchestrate the complete evaluation workflow using LangGraph state machine.

**State Machine Nodes:**

```python
# 9 nodes total:
1. scrub_identity     → Remove PII, create anonymized application
2. worker_evaluation  → LLM merit scoring
3. judge_review       → Validation and bias detection
4. [decision_gate]    → Conditional routing (retry/approve/fail)
5. final_scoring      → Aggregate approved scores
6. hash_generation    → Create hash chain entry
7. send_notification  → Email applicant
8. [completed]        → Terminal success state
9. [failed]           → Terminal failure state
```

**State Machine Diagram:**
```
START
  ↓
scrub_identity
  ↓
worker_evaluation
  ↓
judge_review
  ↓
decision_gate ──────┐
  │ (rejected)      │
  │ attempt < 3     │
  ↓                 │
worker_evaluation ◄─┘ (retry with feedback)

decision_gate
  │ (approved)
  ↓
final_scoring
  ↓
hash_generation
  ↓
send_notification
  ↓
END (completed)

decision_gate
  │ (rejected, attempt >= 3)
  ↓
END (failed)
```

**Pipeline State Schema:**
```python
class PipelineState(BaseModel):
    # Identifiers
    application_id: str
    anonymized_id: Optional[str] = None

    # Retry tracking
    worker_attempt: int = 0
    max_attempts: int = 3

    # Stage results
    application_data: Optional[Application] = None
    anonymized_data: Optional[AnonymizedApplication] = None
    worker_result: Optional[WorkerResult] = None
    judge_result: Optional[JudgeResult] = None
    final_score: Optional[FinalScore] = None

    # Hash chain
    hash: Optional[str] = None

    # Status tracking
    status: ApplicationStatus
    error: Optional[str] = None

    # Timestamps
    started_at: datetime
    updated_at: datetime
```

**Node Implementation Example:**
```python
def _worker_evaluation_node(self, state: PipelineState) -> PipelineState:
    """Node: Worker LLM evaluation."""
    state.worker_attempt += 1
    attempt = state.worker_attempt

    logger.info(f"[{state.application_id}] Worker attempt {attempt}/{state.max_attempts}")

    try:
        # Get judge feedback if retry
        judge_feedback = state.judge_result.feedback if state.judge_result else None

        # Evaluate
        worker_result = self.worker_llm.evaluate(
            application=state.anonymized_data,
            attempt_number=attempt,
            judge_feedback=judge_feedback
        )

        # Update state
        state.worker_result = worker_result
        state.status = ApplicationStatus.JUDGE_REVIEW
        state.updated_at = datetime.utcnow()

        logger.info(f"[{state.application_id}] Score: {worker_result.total_score:.2f}/100")

    except Exception as e:
        logger.error(f"[{state.application_id}] Worker failed: {e}")
        state.error = str(e)
        state.status = ApplicationStatus.FAILED

    return state
```

**Decision Gate Logic:**
```python
def _decision_gate(self, state: PipelineState) -> Literal["retry", "approve", "fail"]:
    """Conditional edge: Decide whether to retry or proceed."""
    if not state.judge_result:
        return "fail"

    # If approved, proceed to final scoring
    if state.judge_result.decision == JudgeDecision.APPROVED:
        logger.info(f"[{state.application_id}] Decision: APPROVED")
        return "approve"

    # If rejected and under max attempts, retry
    if state.worker_attempt < state.max_attempts:
        logger.info(f"[{state.application_id}] Decision: REJECTED → Retry {state.worker_attempt}/{state.max_attempts}")
        return "retry"

    # Max attempts reached, fail
    logger.warning(f"[{state.application_id}] Decision: FAILED (max attempts reached)")
    state.status = ApplicationStatus.FAILED
    state.error = f"Failed after {state.max_attempts} worker attempts"
    return "fail"
```

**Pipeline Execution:**
```python
def run(self, application: Application) -> PipelineState:
    """Run complete Phase 1 pipeline."""
    logger.info(f"[{application.application_id}] Starting Phase 1 pipeline")

    # Initialize state
    initial_state = PipelineState(
        application_id=application.application_id,
        application_data=application,
        max_attempts=self.settings.max_retry_attempts,
        status=ApplicationStatus.SCRUBBING
    )

    # Run LangGraph
    try:
        final_state = self.graph.invoke(initial_state)

        if final_state.status == ApplicationStatus.COMPLETED:
            logger.info(f"[{application.application_id}] ✓ Complete! Score: {final_state.final_score.final_score:.2f}/100")
        else:
            logger.error(f"[{application.application_id}] ✗ Failed: {final_state.error}")

        return final_state

    except Exception as e:
        logger.error(f"[{application.application_id}] Pipeline error: {e}")
        initial_state.status = ApplicationStatus.FAILED
        initial_state.error = str(e)
        return initial_state
```

**Error Handling:**
- Each node catches exceptions and sets `state.error`
- Failed nodes set `status = FAILED`, triggering pipeline termination
- Notification failures don't fail pipeline (logged warning)

---

## Data Models & Schemas

### Pydantic Model Hierarchy

```python
# Base Models
Application                    # Raw application submitted by applicant
AnonymizedApplication          # Identity-scrubbed application
WorkerResult                   # Worker LLM evaluation output
JudgeResult                    # Judge LLM validation output
FinalScore                     # Final aggregated Phase 1 score
AuditLog                       # Audit log entry
HashChainEntry                 # Hash chain entry for tamper detection
PipelineState                  # LangGraph state machine state

# Enums
ApplicationStatus              # Workflow state tracking
JudgeDecision                  # APPROVED | REJECTED

# API Response Models
ApplicationSubmitResponse
ApplicationStatusResponse
ResultsResponse
VerifyResponse
DashboardStatsResponse
```

### Application Schema

```python
class Application(BaseModel):
    application_id: str = Field(default_factory=lambda: f"APP_{uuid.uuid4().hex[:8].upper()}")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # PII - will be scrubbed
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)

    # Merit data
    gpa: float = Field(..., ge=0.0, le=4.0, description="GPA on 4.0 scale")
    test_scores: Dict[str, float] = Field(
        ...,
        description="Standardized test scores, e.g., {'SAT': 1450, 'ACT': 32}"
    )
    essay: str = Field(..., min_length=100, max_length=5000)
    achievements: str = Field(..., min_length=10, max_length=3000)

    # Metadata
    status: ApplicationStatus = Field(default=ApplicationStatus.SUBMITTED)

    @field_validator('test_scores')
    @classmethod
    def validate_test_scores(cls, v: Dict[str, float]) -> Dict[str, float]:
        if not v:
            raise ValueError("At least one test score is required")
        for test_name, score in v.items():
            if score < 0:
                raise ValueError(f"Test score for {test_name} cannot be negative")
        return v
```

### WorkerResult Schema

```python
class WorkerResult(BaseModel):
    result_id: str = Field(default_factory=lambda: f"WKR_{uuid.uuid4().hex[:8].upper()}")
    anonymized_id: str
    attempt_number: int = Field(..., ge=1, le=10)

    # Scores (0-100 scale)
    academic_score: float = Field(..., ge=0.0, le=100.0)
    test_score: float = Field(..., ge=0.0, le=100.0)
    achievement_score: float = Field(..., ge=0.0, le=100.0)
    essay_score: float = Field(..., ge=0.0, le=100.0)
    total_score: float = Field(..., ge=0.0, le=100.0)

    # Explanations
    explanation: str = Field(..., min_length=50)
    reasoning: Dict[str, str] = Field(
        ...,
        description="Category-specific reasoning: {'academic': '...', 'test': '...', ...}"
    )
    rubric_adherence: str = Field(..., min_length=20)

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = None

    @field_validator('total_score')
    @classmethod
    def validate_total_score(cls, v: float, info) -> float:
        """Ensure total_score is reasonable average of component scores."""
        if hasattr(info, 'data'):
            data = info.data
            avg = (
                data.get('academic_score', 0) +
                data.get('test_score', 0) +
                data.get('achievement_score', 0) +
                data.get('essay_score', 0)
            ) / 4
            if abs(v - avg) > 20:  # Allow flexibility for weighting
                raise ValueError(f"total_score {v} inconsistent with components (avg: {avg})")
        return v
```

### FinalScore Schema

```python
class FinalScore(BaseModel):
    anonymized_id: str

    # Final scores
    final_score: float = Field(..., ge=0.0, le=100.0)
    academic_score: float = Field(..., ge=0.0, le=100.0)
    test_score: float = Field(..., ge=0.0, le=100.0)
    achievement_score: float = Field(..., ge=0.0, le=100.0)
    essay_score: float = Field(..., ge=0.0, le=100.0)

    # Explanations
    explanation: str = Field(..., min_length=50)
    strengths: List[str] = Field(..., min_items=1)
    areas_for_improvement: List[str] = Field(..., min_items=1)

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    hash: Optional[str] = Field(None, description="SHA-256 hash for audit trail")
    worker_attempts: int = Field(..., ge=1)
```

### ApplicationStatus Enum

```python
class ApplicationStatus(str, Enum):
    SUBMITTED = "submitted"
    SCRUBBING = "identity_scrubbing"
    WORKER_EVALUATION = "worker_evaluation"
    JUDGE_REVIEW = "judge_review"
    RETRY = "retry"
    FINAL_SCORING = "final_scoring"
    HASH_GENERATION = "hash_generation"
    NOTIFICATION = "notification"
    COMPLETED = "completed"
    FAILED = "failed"
```

---

## API Reference

### REST Endpoints (FastAPI)

**Base URL:** `http://localhost:8000`

#### 1. Health Check

```http
GET /health
```

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2025-10-11T12:34:56.789Z",
    "data_dir": "./data",
    "api_configured": true
}
```

#### 2. Submit Application

```http
POST /applications
Content-Type: application/json

{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1-555-0123",
    "address": "123 Main St, City, State",
    "gpa": 3.8,
    "test_scores": {"SAT": 1450, "ACT": 32},
    "essay": "My passion for computer science began...",
    "achievements": "Science fair winner, coding club founder..."
}
```

**Response (202 Accepted):**
```json
{
    "success": true,
    "application_id": "APP_A7K9M2B4",
    "message": "Application submitted successfully. Processing in background.",
    "status": "submitted",
    "timestamp": "2025-10-11T12:35:00.000Z"
}
```

**Processing:** Happens asynchronously via FastAPI BackgroundTasks.

#### 3. Get Application Status

```http
GET /applications/{application_id}
```

**Response:**
```json
{
    "application_id": "APP_A7K9M2B4",
    "anonymized_id": "ANON_1728648900000_F3D8E1",
    "status": "completed",
    "message": "Evaluation complete. Results available.",
    "timestamp": "2025-10-11T12:40:00.000Z"
}
```

**Status Values:**
- `submitted` - Received, queued for processing
- `identity_scrubbing` - Removing PII
- `worker_evaluation` - AI evaluation in progress
- `judge_review` - Validation in progress
- `completed` - Finished successfully
- `failed` - Processing failed

#### 4. Get Evaluation Results

```http
GET /results/{anonymized_id}
```

**Response:**
```json
{
    "anonymized_id": "ANON_1728648900000_F3D8E1",
    "final_score": 82.5,
    "academic_score": 85.0,
    "test_score": 88.0,
    "achievement_score": 78.0,
    "essay_score": 80.0,
    "explanation": "The applicant demonstrates strong academic performance with a 3.8 GPA and consistent trajectory. Standardized test scores are in the 89th percentile. Notable achievements include regional science fair recognition and founding a coding club. The essay shows genuine intellectual curiosity and thoughtful exploration of AI ethics.",
    "strengths": [
        "Strong academic performance (85/100)",
        "Excellent test scores (88/100)",
        "Compelling essay (80/100)"
    ],
    "areas_for_improvement": [
        "Additional leadership experience would strengthen profile"
    ],
    "hash": "a7f8e3b9c2d4f1a8e6b3c9d2f4a7e1b8c3d9f2a4e7b1c8d3f9a2e4b7c1d8f3a9",
    "timestamp": "2025-10-11T12:40:00.000Z",
    "worker_attempts": 1
}
```

#### 5. Verify Decision Hash

```http
POST /verify
Content-Type: application/json

{
    "anonymized_id": "ANON_1728648900000_F3D8E1",
    "expected_hash": "a7f8e3b9c2d4f1a8e6b3c9d2f4a7e1b8c3d9f2a4e7b1c8d3f9a2e4b7c1d8f3a9"
}
```

**Response:**
```json
{
    "anonymized_id": "ANON_1728648900000_F3D8E1",
    "is_valid": true,
    "stored_hash": "a7f8e3b9c2d4f1a8e6b3c9d2f4a7e1b8c3d9f2a4e7b1c8d3f9a2e4b7c1d8f3a9",
    "expected_hash": "a7f8e3b9c2d4f1a8e6b3c9d2f4a7e1b8c3d9f2a4e7b1c8d3f9a2e4b7c1d8f3a9",
    "message": "Hash verification successful"
}
```

#### 6. Verify Entire Hash Chain

```http
GET /verify/chain
```

**Response:**
```json
{
    "is_valid": true,
    "chain_length": 127,
    "first_entry": "2025-10-01T08:00:00.000Z",
    "last_entry": "2025-10-11T12:40:00.000Z",
    "invalid_entries": [],
    "timestamp": "2025-10-11T12:45:00.000Z"
}
```

#### 7. Dashboard Statistics

```http
GET /dashboard/stats
```

**Response:**
```json
{
    "total_applications": 150,
    "completed_evaluations": 127,
    "average_score": 76.3,
    "score_distribution": {
        "90-100": 12,
        "80-89": 38,
        "70-79": 52,
        "60-69": 20,
        "below-60": 5
    },
    "processing_stats": {
        "submitted": 5,
        "worker_evaluation": 8,
        "completed": 127,
        "failed": 10
    },
    "timestamp": "2025-10-11T12:45:00.000Z"
}
```

### CORS Configuration

```python
allow_origins=["http://localhost:3000", "http://localhost:3001"]  # Frontend URLs
allow_credentials=True
allow_methods=["*"]
allow_headers=["*"]
```

**Security Note:** For production, restrict origins to actual frontend domain.

---

## LLM Integration

### OpenAI API Configuration

**Models Used:**
- Worker: `gpt-5` (complex reasoning, merit evaluation)
- Judge: `gpt-5-mini` (efficient validation)

**Important:** GPT-5 series does NOT support:
- `temperature` parameter
- `max_tokens` parameter
- `max_completion_tokens` parameter

These are kept in configuration for backward compatibility but are not passed to API.

### API Call Pattern

```python
from openai import OpenAI

client = OpenAI(api_key=settings.openai_api_key)

response = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    # NO temperature, max_tokens for GPT-5
)

response_text = response.choices[0].message.content
```

### Retry Logic Implementation

```python
def _call_llm(self, prompt: str, attempt: int = 1) -> str:
    """Call OpenAI API with exponential backoff retry."""
    if attempt > self.settings.api_max_retries:
        raise APIError(f"Max retries ({self.settings.api_max_retries}) exceeded")

    try:
        response = self.client.chat.completions.create(...)
        return response.choices[0].message.content

    except RateLimitError:
        wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
        logger.warning(f"Rate limit hit, waiting {wait_time}s before retry {attempt}")
        time.sleep(wait_time)
        return self._call_llm(prompt, attempt + 1)

    except APITimeoutError:
        wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
        logger.warning(f"API timeout, waiting {wait_time}s before retry {attempt}")
        time.sleep(wait_time)
        return self._call_llm(prompt, attempt + 1)

    except APIError as e:
        if attempt < self.settings.api_max_retries:
            wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
            time.sleep(wait_time)
            return self._call_llm(prompt, attempt + 1)
        else:
            raise
```

**Backoff Schedule:**
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay
- Attempt 5: 8s delay

### Prompt Management

**Storage:** `./prompts/` directory
- `worker_prompt.txt` (150 lines)
- `judge_prompt.txt` (230 lines)
- `rubric.json` (structured criteria)

**Loading:**
```python
def load_prompt(prompt_name: str) -> str:
    """Load prompt from file."""
    prompt_path = settings.prompt_dir / prompt_name
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")
```

**Caching:** Prompts loaded once on service initialization, not per-request.

### Response Parsing

**Expected Format:** JSON (potentially wrapped in markdown code blocks)

```python
def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
    """Parse LLM response and extract JSON."""
    # Handle markdown code blocks
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        json_text = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        json_text = response_text[start:end].strip()
    else:
        json_text = response_text.strip()

    # Parse JSON
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON response: {e}")

    # Validate required fields
    required_fields = ["academic_score", "test_score", ...]
    missing = [f for f in required_fields if f not in data]
    if missing:
        raise ValueError(f"Missing fields: {missing}")

    return data
```

### Cost Optimization

**Current Strategy:**
- Worker: GPT-5 (high-quality evaluation)
- Judge: GPT-5-mini (cost-efficient validation)

**Estimated Costs (per application):**
- Worker: ~$0.05-0.10 (including retries)
- Judge: ~$0.01-0.02
- Total: ~$0.06-0.12 per application

**Future Optimization:**
- Batch API calls for parallel processing
- Caching for similar applications (ethical concerns)
- Fine-tuned models for specific domains

---

## Security Architecture

### Threat Model

**Assets to Protect:**
1. **PII Data:** Names, emails, phone numbers, addresses
2. **Application Content:** Essays, achievements (intellectual property)
3. **Evaluation Results:** Scores, decisions, feedback
4. **Audit Trail:** Hash chain, audit logs

**Threat Actors:**
- Malicious applicants (attempting to game the system)
- External attackers (data exfiltration)
- Internal users (unauthorized access)

**Attack Vectors:**
- API abuse (spam, DoS)
- Data tampering (modify scores)
- Privacy violations (PII leakage)
- Bias injection (LLM prompt attacks)

### Current Security Measures

#### 1. PII Protection

**Identity Scrubbing:**
- 8 regex patterns for PII detection
- Anonymization before LLM processing
- Separate encrypted storage (identity_mapping.csv)

**Current Encryption:** ❌ Base64 encoding (NOT secure)
```python
# INSECURE - MVP only
encrypted_pii = base64.b64encode(pii_json.encode('utf-8')).decode('utf-8')
```

**Required for Production:** ✅ Fernet symmetric encryption
```python
from cryptography.fernet import Fernet

cipher = Fernet(settings.identity_mapping_encryption_key)  # 32-byte key
encrypted_pii = cipher.encrypt(pii_json.encode('utf-8'))
```

#### 2. Audit Logging

**Complete Action Trail:**
- All operations logged to `audit_log.csv`
- Immutable append-only structure
- Actor tracking (system, worker_llm, judge_llm, user)
- Timestamp and entity traceability

**Example Audit Entry:**
```csv
log_id,timestamp,entity_type,entity_id,action,actor,details_json,metadata_json
LOG_A7F8E3B9C2D4,2025-10-11T12:35:00,Application,APP_A7K9M2B4,CREATE,system,"{""source"":""api""}","{}"
```

#### 3. Cryptographic Hash Chain

**Tamper Detection:**
- SHA-256 hash chain linking all decisions
- Any modification breaks the chain
- Verifiable by third parties

**Properties:**
- **Immutability:** Past entries cannot be changed
- **Transparency:** Full audit trail
- **Verifiability:** Independent verification possible

#### 4. Input Validation

**Pydantic Schema Validation:**
- Type checking at runtime
- Range constraints (e.g., GPA 0.0-4.0)
- Length limits (e.g., essay 100-5000 chars)
- Format validation (e.g., EmailStr)

**Example:**
```python
class Application(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr  # Validates email format
    gpa: float = Field(..., ge=0.0, le=4.0)  # Range constraint
    essay: str = Field(..., min_length=100, max_length=5000)
```

### Security Vulnerabilities

#### Critical Issues

**1. Identity Mapping Not Encrypted**
- **Severity:** CRITICAL
- **Impact:** PII exposed in plaintext (base64 is encoding, not encryption)
- **Mitigation:** Implement Fernet encryption with secure key management

**2. No API Authentication**
- **Severity:** CRITICAL
- **Impact:** Anyone can submit/query applications
- **Mitigation:** Implement API key authentication or JWT tokens

**3. No Rate Limiting**
- **Severity:** HIGH
- **Impact:** Vulnerable to DoS attacks, spam applications
- **Mitigation:** Add rate limiting middleware (e.g., SlowAPI)

**4. CORS Too Permissive**
- **Severity:** MEDIUM
- **Impact:** Allows requests from any origin (in dev mode)
- **Mitigation:** Restrict origins to actual frontend domain

**5. No CSRF Protection**
- **Severity:** MEDIUM
- **Impact:** Vulnerable to cross-site request forgery
- **Mitigation:** Implement CSRF tokens for state-changing operations

**6. File Permissions Not Set**
- **Severity:** MEDIUM
- **Impact:** CSV files readable by all users on system
- **Mitigation:** Set file permissions to 600 (owner read/write only)

### Security Recommendations

#### Immediate (Pre-Production)

1. **Encrypt Identity Mapping**
```python
from cryptography.fernet import Fernet

# Generate key (store in secrets manager)
key = Fernet.generate_key()  # 32 bytes

# Encryption
cipher = Fernet(key)
encrypted = cipher.encrypt(pii_json.encode('utf-8'))

# Decryption
decrypted = cipher.decrypt(encrypted).decode('utf-8')
```

2. **Add API Authentication**
```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="X-API-Key")

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

3. **Implement Rate Limiting**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/applications")
@limiter.limit("10/minute")
async def submit_application(...):
    ...
```

4. **Set File Permissions**
```python
import os

# Set permissions on sensitive CSVs
for csv_file in [identity_mapping_csv, applications_csv, ...]:
    os.chmod(csv_file, 0o600)  # Owner read/write only
```

#### Medium Priority

5. **Add Request Signing**
- Use HMAC-SHA256 for request integrity
- Prevent request tampering

6. **Implement Secrets Management**
- Use AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault
- Rotate keys regularly
- Never commit secrets to git

7. **Add Database Encryption at Rest**
- When migrating from CSV to database
- Use database-level encryption (e.g., PostgreSQL pgcrypto)

8. **Audit Log Integrity**
- Sign audit log entries with HMAC
- Prevent audit log tampering

#### Long-Term

9. **Add User Authentication & Authorization**
- User roles (applicant, reviewer, admin)
- Role-based access control (RBAC)
- OAuth2/OpenID Connect integration

10. **Implement Network Security**
- TLS/SSL for all connections
- VPC isolation in cloud deployment
- Web Application Firewall (WAF)

---

## Data Flow & State Machine

### Complete Application Lifecycle

```
1. SUBMISSION
   ├─ User submits via API or CLI
   ├─ Pydantic validation
   ├─ Generate application_id (APP_XXXXXXXX)
   ├─ Persist to applications.csv
   └─ Return application_id to user

2. IDENTITY SCRUBBING
   ├─ Load application from CSV
   ├─ Generate anonymized_id (ANON_timestamp_XXXXXX)
   ├─ Apply 8 PII scrubbing patterns
   ├─ Store scrubbed version in anonymized.csv
   ├─ Encrypt PII → identity_mapping.csv
   └─ Log scrubbing metrics

3. WORKER EVALUATION (Attempt 1)
   ├─ Load anonymized application
   ├─ Build evaluation prompt (no feedback)
   ├─ Call GPT-5 with retry logic
   ├─ Parse JSON response
   ├─ Validate scores (Pydantic)
   ├─ Calculate weighted total
   ├─ Persist to phase1_worker_results.csv
   └─ Log evaluation completion

4. JUDGE REVIEW (Attempt 1)
   ├─ Load anonymized application + worker result
   ├─ Build validation prompt
   ├─ Call GPT-5-mini with retry logic
   ├─ Parse JSON response
   ├─ Check bias indicators
   ├─ Assess quality score
   ├─ Make decision (APPROVED / REJECTED)
   ├─ Persist to phase1_judge_results.csv
   └─ Log judge decision

5. DECISION GATE
   ├─ If APPROVED → Go to FINAL SCORING
   ├─ If REJECTED + attempts < 3:
   │  ├─ Extract judge feedback
   │  └─ Return to WORKER EVALUATION (Attempt N+1)
   └─ If REJECTED + attempts >= 3:
      ├─ Mark application as FAILED
      ├─ Log failure reason
      └─ END (failed terminal state)

6. WORKER EVALUATION (Attempt 2, if needed)
   ├─ Load anonymized application
   ├─ Build evaluation prompt WITH judge feedback
   ├─ Call GPT-5 (incorporates feedback)
   ├─ Parse and validate response
   ├─ Persist attempt #2 to phase1_worker_results.csv
   └─ Return to JUDGE REVIEW

7. FINAL SCORING (After approval)
   ├─ Extract approved worker scores
   ├─ Generate strengths (scores >= 80)
   ├─ Generate improvements (scores < 70)
   ├─ Create FinalScore object
   ├─ Persist to phase1_final_scores.csv
   └─ Log final scoring completion

8. HASH GENERATION
   ├─ Get previous hash from chain
   ├─ Serialize final score data (JSON)
   ├─ Calculate SHA-256 hash: hash(data + previous_hash)
   ├─ Create HashChainEntry
   ├─ Persist to hash_chain.csv
   └─ Update final score with hash

9. NOTIFICATION
   ├─ Retrieve identity from identity_mapping.csv
   ├─ Decrypt PII (get name, email)
   ├─ Build email content (score, explanation, hash)
   ├─ Send via SMTP
   ├─ Log notification delivery
   └─ Mark as COMPLETED (even if email fails)

10. COMPLETED
    ├─ Final status = COMPLETED
    ├─ Full audit trail available
    ├─ Hash chain verifiable
    └─ Results queryable via API
```

### State Transitions

```python
SUBMITTED → SCRUBBING → WORKER_EVALUATION → JUDGE_REVIEW
                                  ↑                │
                                  │                │
                                  └────────────────┘
                                    (retry loop)
                                        │
                                        ▼
                FINAL_SCORING → HASH_GENERATION → NOTIFICATION → COMPLETED

                FAILED (terminal state, reachable from any stage on error)
```

### Retry Loop Details

```python
Attempt 1:
  Worker → Judge → REJECTED? → Attempt 2

Attempt 2:
  Worker (with feedback) → Judge → REJECTED? → Attempt 3

Attempt 3:
  Worker (with feedback) → Judge → REJECTED? → FAILED

Max 3 attempts total per application.
```

### Data Dependencies

```
application_id (primary key)
    ↓ (1:1)
anonymized_id
    ↓ (1:many)
worker_result_id (attempt_number: 1, 2, or 3)
    ↓ (1:1 per attempt)
judge_result_id
    ↓ (1:1, only approved)
final_score (anonymized_id)
    ↓ (1:1)
hash_chain_entry (anonymized_id)
```

---

## Configuration Management

### Environment Variables

**File:** `.env` (not committed to git)

**Required Variables:**
```bash
# OpenAI API
OPENAI_API_KEY=sk-...

# LLM Models
WORKER_MODEL=gpt-5
JUDGE_MODEL=gpt-5-mini

# NOTE: GPT-5 series does not support these parameters
TEMPERATURE=0.1         # Kept for compatibility, not used
MAX_TOKENS=4096         # Kept for compatibility, not used

# Retry Configuration
MAX_RETRY_ATTEMPTS=3    # Worker retry limit
API_RETRY_DELAY=1.0     # Initial backoff delay (seconds)
API_MAX_RETRIES=5       # API call retry limit

# Paths
DATA_DIR=./data
PROMPT_DIR=./prompts
LOG_DIR=./logs

# Email (SMTP)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_FROM=noreply@enigma.edu
EMAIL_PASSWORD=...
EMAIL_USE_TLS=True

# Security
IDENTITY_MAPPING_ENCRYPTION_KEY=...  # 64 hex chars (32 bytes)

# Logging
LOG_LEVEL=INFO
LOG_FILE=./logs/enigma.log

# Scoring Weights
WEIGHT_ACADEMIC=0.30
WEIGHT_TEST=0.25
WEIGHT_ACHIEVEMENT=0.25
WEIGHT_ESSAY=0.20
```

### Settings Management

**Implementation:** Pydantic BaseSettings

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    openai_api_key: str
    worker_model: str = "gpt-5"
    judge_model: str = "gpt-5-mini"
    max_retry_attempts: int = Field(default=3, ge=1, le=10)
    data_dir: Path = Field(default=Path("./data"))

    @field_validator('data_dir', 'prompt_dir', 'log_dir')
    @classmethod
    def ensure_path_exists(cls, v: Path) -> Path:
        """Create directories if they don't exist."""
        v = Path(v)
        v.mkdir(parents=True, exist_ok=True)
        return v

    def validate_scoring_weights(self) -> None:
        """Ensure scoring weights sum to 1.0."""
        total = self.weight_academic + self.weight_test + self.weight_achievement + self.weight_essay
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Scoring weights must sum to 1.0, got {total}")

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    settings.validate_scoring_weights()
    return settings
```

### Configuration Validation

**On Initialization:**
```bash
python src/main.py init
```

**Checks:**
- Data directories exist
- Prompt files exist
- API key configured
- Email configured (optional)
- Scoring weights sum to 1.0

**Output:**
```
✓ Data directory: ./data
✓ Prompt directory: ./prompts
✓ Log directory: ./logs
✓ Worker prompt: ./prompts/worker_prompt.txt
✓ Judge prompt: ./prompts/judge_prompt.txt
✓ Rubric: ./prompts/rubric.json
✓ OpenAI API key configured
✓ Email configured (noreply@enigma.edu)
✓ CSV files initialized in ./data
✓ Initialization complete!
```

---

## Development Guide

### Setup

1. **Clone Repository**
```bash
git clone <repo-url>
cd backend
```

2. **Create Virtual Environment**
```bash
uv venv --python 3.12
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

3. **Install Dependencies**
```bash
uv sync
python -m spacy download en_core_web_sm
```

4. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

5. **Initialize System**
```bash
python src/main.py init
```

### Running Locally

**CLI Mode:**
```bash
# Process batch of applications
python src/main.py run --input applications.json

# Process single application
python src/main.py process --application-id APP_12345678

# Check status
python src/main.py status

# Verify hash chain
python src/main.py verify

# Export results
python src/main.py export --output results.csv
```

**API Mode:**
```bash
# Development server (auto-reload)
uvicorn api:app --reload --host 0.0.0.0 --port 8000

# Production server
uvicorn api:app --host 0.0.0.0 --port 8000 --workers 4
```

**API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Code Style

**Formatting:**
```bash
black src/ --line-length 100
isort src/
```

**Type Checking:**
```bash
mypy src/ --strict
```

**Linting:**
```bash
flake8 src/ --max-line-length 100
pylint src/
```

### Adding New Features

**1. Add Data Model**
```python
# src/models/schemas.py
class NewFeature(BaseModel):
    feature_id: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

**2. Add CSV Schema**
```python
# src/utils/csv_handler.py
NEW_FEATURE_CSV = "new_feature.csv"

def _ensure_csv_files_exist(self):
    csv_schemas = {
        ...
        self.NEW_FEATURE_CSV: ["feature_id", "data_json", "timestamp"]
    }
```

**3. Add Service Method**
```python
# src/services/new_service.py
class NewService:
    def process_feature(self, data: Dict[str, Any]) -> NewFeature:
        """Process new feature."""
        feature = NewFeature(**data)
        self.csv_handler.append_new_feature(feature)
        return feature
```

**4. Add Pipeline Node (if needed)**
```python
# src/orchestration/phase1_pipeline.py
def _new_feature_node(self, state: PipelineState) -> PipelineState:
    """Node: Process new feature."""
    try:
        result = self.new_service.process_feature(state.data)
        state.new_feature_result = result
        state.status = ApplicationStatus.NEXT_STAGE
    except Exception as e:
        state.error = str(e)
        state.status = ApplicationStatus.FAILED
    return state
```

**5. Add API Endpoint**
```python
# api.py
@app.post("/new-feature")
async def create_new_feature(request: NewFeatureRequest):
    """Create new feature."""
    service = NewService()
    result = service.process_feature(request.dict())
    return {"feature_id": result.feature_id, "status": "created"}
```

**6. Update Documentation**
- Add to BACKEND.md
- Update API reference
- Add examples

---

## Testing Strategy

### Test Structure (Planned)

```
tests/
├── unit/
│   ├── test_models.py              # Pydantic validation
│   ├── test_identity_scrubber.py   # PII removal
│   ├── test_hash_chain.py          # Cryptographic functions
│   ├── test_csv_handler.py         # CSV operations
│   └── test_config.py              # Settings validation
├── integration/
│   ├── test_worker_llm.py          # LLM service (mocked)
│   ├── test_judge_llm.py           # LLM service (mocked)
│   ├── test_pipeline.py            # End-to-end pipeline
│   └── test_api.py                 # FastAPI endpoints
├── fixtures/
│   ├── sample_applications.json    # Test data
│   ├── mock_llm_responses.json     # LLM response fixtures
│   └── expected_results.json       # Expected outputs
└── conftest.py                     # Pytest configuration
```

### Unit Test Examples

**Test PII Scrubbing:**
```python
def test_scrub_email():
    scrubber = IdentityScrubber(csv_handler, audit_logger)
    text = "Contact me at jane@example.com for more info."
    scrubbed = scrubber._scrub_emails(text)
    assert "[EMAIL_REDACTED]" in scrubbed
    assert "jane@example.com" not in scrubbed

def test_scrub_phone():
    scrubber = IdentityScrubber(csv_handler, audit_logger)
    text = "Call me at +1-555-123-4567."
    scrubbed = scrubber._scrub_phones(text)
    assert "[PHONE_REDACTED]" in scrubbed
    assert "555-123-4567" not in scrubbed
```

**Test Hash Chain:**
```python
def test_generate_hash():
    hash_chain = HashChainGenerator(csv_handler)
    data = {"score": 85, "id": "ANON_123"}
    hash1 = hash_chain.generate_hash(data, "0" * 64)
    hash2 = hash_chain.generate_hash(data, "0" * 64)
    assert hash1 == hash2  # Deterministic
    assert len(hash1) == 64  # SHA-256 hex

def test_verify_chain():
    hash_chain = HashChainGenerator(csv_handler)
    entries = [...]  # Create test chain
    result = hash_chain.verify_chain(entries)
    assert result["is_valid"] == True
```

### Integration Test Examples

**Test Worker LLM (Mocked):**
```python
def test_worker_evaluation(mock_openai):
    mock_openai.return_value = load_fixture("mock_worker_response.json")

    worker = WorkerLLM(csv_handler, audit_logger)
    application = AnonymizedApplication(...)
    result = worker.evaluate(application)

    assert result.total_score >= 0 and result.total_score <= 100
    assert result.explanation
    assert "academic" in result.reasoning
```

**Test Full Pipeline:**
```python
def test_pipeline_end_to_end(mock_llm_services):
    application = Application(
        name="Test Applicant",
        email="test@example.com",
        gpa=3.8,
        test_scores={"SAT": 1450},
        essay="...",
        achievements="..."
    )

    final_state = run_pipeline(application)

    assert final_state.status == ApplicationStatus.COMPLETED
    assert final_state.final_score is not None
    assert final_state.hash is not None
```

### Running Tests

```bash
# All tests
pytest

# Unit tests only
pytest tests/unit/

# Integration tests
pytest tests/integration/

# With coverage
pytest --cov=src --cov-report=html

# Specific test
pytest tests/unit/test_identity_scrubber.py::test_scrub_email -v
```

### Coverage Goals

- **Unit Tests:** >80% coverage
- **Integration Tests:** >60% coverage
- **Critical Paths:** 100% coverage (identity scrubbing, hash chain, worker-judge loop)

---

## Deployment Guide

### Local Deployment

**Prerequisites:**
- Python 3.12+
- Virtual environment (uv)
- OpenAI API key
- SMTP credentials (for email)

**Steps:**
```bash
# 1. Setup
cd backend
uv venv --python 3.12
source venv/bin/activate
uv sync
python -m spacy download en_core_web_sm

# 2. Configure
cp .env.example .env
# Edit .env with credentials

# 3. Initialize
python src/main.py init

# 4. Run API server
uvicorn api:app --host 0.0.0.0 --port 8000
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN pip install uv && uv sync

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application
COPY . .

# Create data directories
RUN mkdir -p data logs

# Expose port
EXPOSE 8000

# Run API server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build and Run:**
```bash
docker build -t enigma-backend .
docker run -d -p 8000:8000 --env-file .env enigma-backend
```

### Cloud Deployment (AWS)

**Architecture:**
```
┌──────────────────────────────────────────────┐
│  CloudFront (CDN)                            │
│  ├─ Frontend (S3 + CloudFront)              │
│  └─ API Gateway                              │
│      └─ ECS Fargate (Backend)               │
│          ├─ API Container (2+ instances)    │
│          └─ Worker Container (for CLI)      │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  RDS PostgreSQL (replaces CSV)      │   │
│  │  ├─ Primary instance                │   │
│  │  └─ Read replicas                   │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  S3 Buckets                         │   │
│  │  ├─ Encrypted backups               │   │
│  │  └─ Audit logs (Glacier archival)  │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  Secrets Manager                    │   │
│  │  ├─ OpenAI API key                  │   │
│  │  ├─ Database credentials            │   │
│  │  └─ Encryption keys                 │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  CloudWatch                         │   │
│  │  ├─ Logs                            │   │
│  │  ├─ Metrics                         │   │
│  │  └─ Alarms                          │   │
│  └─────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

**Terraform Configuration (Example):**
```hcl
# ECS Fargate Service
resource "aws_ecs_service" "enigma_backend" {
  name            = "enigma-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private.*.id
    security_groups = [aws_security_group.backend.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "enigma" {
  identifier        = "enigma-db"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.t4g.medium"
  allocated_storage = 100

  storage_encrypted = true
  kms_key_id        = aws_kms_key.db.arn

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
}
```

### Monitoring & Logging

**CloudWatch Metrics:**
- API request rate
- LLM API latency
- Error rates
- Worker retry rates
- Pipeline completion time

**CloudWatch Alarms:**
```python
# High error rate
if error_rate > 5%:
    alert_sns_topic()

# Slow processing
if p99_latency > 120s:
    alert_sns_topic()

# Failed applications
if failed_count > 10:
    alert_sns_topic()
```

**Log Aggregation:**
- All logs → CloudWatch Logs
- Archive to S3 (long-term storage)
- Use CloudWatch Insights for querying

---

## Performance Optimization

### Current Bottlenecks

1. **Sequential Processing**
   - Applications processed one at a time
   - No parallel execution

2. **LLM API Latency**
   - GPT-5: ~10-30s per request
   - Judge: ~5-15s per request
   - Dominates total processing time

3. **CSV Linear Scans**
   - O(n) lookups for application_id, anonymized_id
   - No indexing

4. **Full File Rewrites**
   - Atomic append reads entire file, writes back
   - O(n) for each append operation

### Optimization Strategies

#### 1. Parallel Processing

**Current (Sequential):**
```python
for application in applications:
    run_pipeline(application)
```

**Optimized (Parallel):**
```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(run_pipeline, app) for app in applications]
    results = [f.result() for f in futures]
```

**Expected Improvement:** 5-10x throughput for batch processing

#### 2. LLM Request Batching

**Future:** Use OpenAI Batch API
```python
# Create batch request
batch = openai.batches.create(
    input_file_id=file_id,
    endpoint="/v1/chat/completions",
    completion_window="24h"
)

# Process results when complete
```

**Cost Savings:** 50% discount on batch requests

#### 3. Database Migration

**Replace CSV with PostgreSQL:**
```sql
CREATE TABLE applications (
    application_id VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    gpa DECIMAL(3,2),
    test_scores JSONB,
    essay TEXT,
    achievements TEXT,
    status VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_timestamp ON applications(timestamp);
```

**Expected Improvement:**
- Lookups: O(n) → O(log n) or O(1) with index
- No full file rewrites
- ACID transactions
- Concurrent access without file locks

#### 4. Caching

**Cache Prompts:**
```python
@lru_cache(maxsize=1)
def load_worker_prompt() -> str:
    """Load and cache worker prompt."""
    return settings.load_prompt("worker_prompt.txt")
```

**Cache Settings:**
```python
@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
```

#### 5. Async LLM Calls

**Current (Synchronous):**
```python
response = client.chat.completions.create(...)
```

**Optimized (Async):**
```python
async def _call_llm_async(self, prompt: str) -> str:
    """Async LLM API call."""
    response = await self.async_client.chat.completions.create(
        model=self.settings.worker_model,
        messages=[...]
    )
    return response.choices[0].message.content
```

### Performance Benchmarks

**Current (Sequential, CSV):**
- Throughput: 10-15 applications/minute
- Latency (per application): 30-60s
- Bottleneck: LLM API calls

**Optimized (Parallel, PostgreSQL):**
- Throughput: 100-150 applications/minute (10x improvement)
- Latency (per application): 30-60s (unchanged, LLM-bound)
- Bottleneck: Still LLM API, but 10x more concurrent requests

---

## Troubleshooting

### Common Issues

#### 1. `OpenAI API key not configured`

**Symptom:**
```
✗ OpenAI API key not configured
```

**Solution:**
```bash
# Check .env file
cat .env | grep OPENAI_API_KEY

# If missing, add:
echo "OPENAI_API_KEY=sk-..." >> .env

# Verify:
python -c "import os; print(os.getenv('OPENAI_API_KEY', 'NOT_SET'))"
```

#### 2. `Rate limit exceeded` (OpenAI)

**Symptom:**
```
ERROR: Rate limit hit, waiting 1s before retry 1
```

**Solution:**
- Wait for retry (exponential backoff)
- Upgrade OpenAI plan for higher limits
- Reduce concurrent processing

#### 3. `CSV file locked` (Windows)

**Symptom:**
```
PermissionError: [Errno 13] Permission denied: 'data/applications.csv'
```

**Solution:**
- Close Excel or any program reading the CSV
- Check for zombie processes:
```bash
# Windows
tasklist | findstr python
taskkill /PID <pid> /F

# Unix
ps aux | grep python
kill -9 <pid>
```

#### 4. `Prompt file not found`

**Symptom:**
```
FileNotFoundError: Prompt file not found: ./prompts/worker_prompt.txt
```

**Solution:**
```bash
# Verify prompts directory
ls prompts/

# If missing, create:
mkdir -p prompts
# Copy prompt files from repository
```

#### 5. `Hash chain verification failed`

**Symptom:**
```
✗ Hash chain is INVALID
  Invalid entries: 1
    - Index 42: HASH_A7F8E3B9 (2025-10-11T12:40:00)
```

**Solution:**
- **DO NOT modify CSV files manually** (breaks hash chain)
- Check for data corruption:
```bash
python src/main.py verify
```
- If intentional (e.g., migration), regenerate chain:
```bash
# Backup existing chain
cp data/hash_chain.csv data/hash_chain.csv.bak

# Regenerate (requires custom script)
```

#### 6. `Email notification failed`

**Symptom:**
```
WARNING: [APP_12345678] Notification failed: SMTPAuthenticationError
```

**Solution:**
```bash
# Check SMTP credentials
python -c "
from src.config.settings import get_settings
s = get_settings()
print(f'SMTP: {s.email_smtp_host}:{s.email_smtp_port}')
print(f'From: {s.email_from}')
print(f'TLS: {s.email_use_tls}')
"

# Test SMTP connection
python src/main.py test-connection
```

#### 7. `Pipeline stuck in worker_evaluation`

**Symptom:**
- Application status = `worker_evaluation` for >5 minutes
- No progress logs

**Solution:**
```bash
# Check logs
tail -f logs/enigma.log

# Check for LLM API issues
curl https://status.openai.com/api/v2/status.json

# Restart pipeline
python src/main.py process --application-id APP_12345678
```

### Debug Mode

**Enable Verbose Logging:**
```bash
# In .env
LOG_LEVEL=DEBUG

# Or via environment variable
export LOG_LEVEL=DEBUG
python src/main.py run --input applications.json
```

**Log Output:**
```
DEBUG: [APP_12345678] Starting identity scrubbing
DEBUG: Applied 12 redactions to APP_12345678
DEBUG: Stored identity mapping: ANON_1728648900000_F3D8E1 ← APP_12345678
DEBUG: Building evaluation prompt for ANON_1728648900000_F3D8E1
DEBUG: LLM response (3247 chars)
...
```

### Performance Profiling

**Profile Pipeline:**
```bash
python -m cProfile -o profile.stats src/main.py run --input applications.json
python -m pstats profile.stats
```

**Analyze:**
```python
import pstats
p = pstats.Stats('profile.stats')
p.sort_stats('cumulative')
p.print_stats(20)  # Top 20 functions
```

---

## Known Issues & Limitations

### Critical Issues

1. **Identity Mapping Not Encrypted**
   - **Impact:** PII exposed in `identity_mapping.csv`
   - **Status:** Known MVP limitation
   - **Fix:** Implement Fernet encryption before production

2. **No API Authentication**
   - **Impact:** Open access to all endpoints
   - **Status:** Security vulnerability
   - **Fix:** Add API key auth or JWT

3. **CSV Doesn't Scale**
   - **Impact:** O(n) lookups, file locking issues
   - **Status:** Architectural limitation
   - **Fix:** Migrate to PostgreSQL

### Medium Priority

4. **No Retry for Failed Notifications**
   - **Impact:** Users may not receive results email
   - **Status:** Logged but not retried
   - **Fix:** Add notification queue with retries

5. **Worker Prompts Hardcoded**
   - **Impact:** Cannot A/B test prompts easily
   - **Status:** Single prompt per environment
   - **Fix:** Version prompts, support multi-variant testing

6. **No User Management**
   - **Impact:** Cannot track who submitted applications
   - **Status:** Anonymous submissions
   - **Fix:** Add user authentication and ownership

### Minor Issues

7. **CSV Field Name Mismatch**
   - **Impact:** `test_scores_json` in CSV vs `test_scores` in model
   - **Status:** Works but inconsistent
   - **Fix:** Standardize naming

8. **No Request ID Tracing**
   - **Impact:** Hard to trace logs across distributed calls
   - **Status:** Application ID used, but not request-level
   - **Fix:** Add correlation IDs

9. **Synchronous Email Sending**
   - **Impact:** Blocks pipeline completion
   - **Status:** Not critical (completes anyway)
   - **Fix:** Use async SMTP or queue

### Documentation Gaps

10. **Missing CLI Commands**
    - README mentions: `test-connection`, `verify-data`, `restore`, `test-scrubbing`
    - **Status:** Not implemented
    - **Fix:** Implement or remove from docs

---

## Future Enhancements

### Phase 1.5 (Security & Stability)

1. **Implement Proper Encryption**
   - Fernet encryption for identity mapping
   - Key rotation support
   - Secrets management (AWS Secrets Manager)

2. **Add Authentication & Authorization**
   - API key authentication
   - JWT tokens for user sessions
   - Role-based access control (applicant, reviewer, admin)

3. **Comprehensive Testing**
   - Unit tests (>80% coverage)
   - Integration tests
   - End-to-end tests
   - LLM response fixtures

4. **Monitoring & Alerting**
   - CloudWatch / Prometheus metrics
   - Error tracking (Sentry)
   - Performance monitoring (New Relic, DataDog)

### Phase 2 (Scalability)

5. **Database Migration**
   - PostgreSQL with full-text search
   - Indexes for fast lookups
   - Connection pooling

6. **Async Task Queue**
   - Celery + Redis
   - Priority queues
   - Scheduled jobs

7. **Horizontal Scaling**
   - Stateless API servers
   - Load balancing
   - Auto-scaling based on demand

8. **Caching Layer**
   - Redis for session data
   - Application-level caching
   - CDN for static assets

### Phase 3 (Features)

9. **Real-Time Updates**
   - WebSocket support
   - Server-sent events
   - Live status dashboard

10. **Advanced Analytics**
    - Score distribution analysis
    - Bias detection metrics
    - Worker-Judge agreement rates
    - Retry pattern analysis

11. **Multi-Phase Support**
    - Phase 2: Human interviews with AI bias monitoring
    - Phase 3: Final decision aggregation
    - Unified scoring across phases

12. **Admin Dashboard**
    - Application management UI
    - Hash chain verification UI
    - Manual review capabilities
    - Audit log explorer

13. **Appeal Workflow**
    - Applicants can request review
    - Manual override by admins
    - Audit trail for appeals

### Phase 4 (Advanced AI)

14. **Fine-Tuned Models**
    - Custom models for specific domains
    - Institution-specific rubrics
    - Transfer learning from historical data

15. **Explainability Dashboard**
    - Visualize scoring factors
    - Compare to peer applications
    - Interactive "what-if" scenarios

16. **Bias Auditing**
    - Automated bias detection across cohorts
    - Fairness metrics (demographic parity, equal opportunity)
    - Adversarial testing

---

## Conclusion

The ENIGMA Phase 1 backend implements a sophisticated AI-powered blind merit screening system with strong bias mitigation, cryptographic audit trails, and explainable decisions. The architecture is well-designed for MVP deployment, with clear paths for production hardening and scaling.

**Key Strengths:**
- Robust worker-judge LLM architecture
- Comprehensive PII scrubbing
- Tamper-evident hash chain
- Type-safe Pydantic models
- Atomic CSV operations

**Production Requirements:**
- Encrypt identity mapping (Fernet)
- Add API authentication
- Migrate from CSV to PostgreSQL
- Implement comprehensive testing
- Set up monitoring & alerting

For questions or contributions, see [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-11
**Maintainer:** ENIGMA Development Team
