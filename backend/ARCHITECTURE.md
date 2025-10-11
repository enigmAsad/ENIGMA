# ENIGMA Phase 1 Backend Architecture

## Overview
Phase 1 implements AI-powered merit screening with blind evaluation, worker-judge validation, and cryptographic audit trails.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1 PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Raw Application (JSON)                                          │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Application      │ → applications.csv                        │
│  │ Collector        │                                            │
│  └──────────────────┘                                           │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Identity         │ → anonymized.csv + identity_mapping.csv   │
│  │ Scrubber         │   (PII removal, anonymized ID generation) │
│  └──────────────────┘                                           │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Worker LLM       │ → phase1_worker_results.csv               │
│  │ (GPT-5)          │   (Merit scoring with explanations)       │
│  └──────────────────┘                                           │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Judge LLM        │ → phase1_judge_results.csv                │
│  │ (GPT-5-mini)     │   (Bias validation, approve/reject)       │
│  └──────────────────┘                                           │
│         ↓                                                        │
│    Decision Gate                                                 │
│    ┌─────────┬─────────┐                                        │
│    │ Reject  │ Approve │                                        │
│    │ (retry) │ (next)  │                                        │
│    └────↑────┴────↓────┘                                        │
│         │          │                                             │
│    (max 3 attempts)│                                             │
│                    ↓                                             │
│  ┌──────────────────┐                                           │
│  │ Score Aggregator │ → phase1_final_scores.csv                 │
│  │ & Ranker         │   (Combined scores + explanations)        │
│  └──────────────────┘                                           │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Hash Chain       │ → hash_chain.csv + audit_log.csv          │
│  │ Generator        │   (SHA-256 tamper-evident logging)        │
│  └──────────────────┘                                           │
│         ↓                                                        │
│  ┌──────────────────┐                                           │
│  │ Email Notifier   │ → Send confirmation & results             │
│  └──────────────────┘                                           │
│         ↓                                                        │
│     Completed                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Python 3.11+**: Core language with type hints
- **LangChain/LangGraph**: Orchestration and state management
- **Pydantic v2**: Data validation and serialization
- **OpenAI GPT API**: LLM provider (GPT-5 for Worker, GPT-5-mini for Judge)
  - **Note**: GPT-5 series does not support `temperature`, `max_tokens`, or `max_completion_tokens` parameters
- **CSV**: Data persistence layer (atomic writes)
- **hashlib**: SHA-256 for hash chain
- **python-dotenv**: Environment configuration
- **smtplib**: Email notifications

## Project Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py              # Configuration management
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py                # Pydantic data models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── application_collector.py  # Application intake
│   │   ├── identity_scrubber.py      # PII removal engine
│   │   ├── worker_llm.py             # Worker evaluation service
│   │   ├── judge_llm.py              # Judge validation service
│   │   ├── hash_chain.py             # Cryptographic audit trail
│   │   └── email_service.py          # Notification system
│   ├── orchestration/
│   │   ├── __init__.py
│   │   └── phase1_pipeline.py        # LangGraph state machine
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── csv_handler.py            # Atomic CSV operations
│   │   └── logger.py                 # Audit logging utilities
│   └── main.py                       # CLI entry point
├── data/                             # CSV storage directory
├── prompts/
│   ├── worker_prompt.txt             # Worker LLM system prompt
│   ├── judge_prompt.txt              # Judge LLM system prompt
│   └── rubric.json                   # Evaluation rubric definition
├── .env.example                      # Environment template
├── requirements.txt                  # Python dependencies
└── README.md                         # Setup instructions
```

## Data Schemas

### applications.csv
```csv
application_id,timestamp,name,email,phone,address,gpa,test_scores,essay,achievements,status
```

### anonymized.csv
```csv
anonymized_id,application_id,gpa,test_scores,essay_scrubbed,achievements_scrubbed,created_at
```

### identity_mapping.csv (encrypted storage)
```csv
anonymized_id,application_id,encrypted_pii,created_at
```

### phase1_worker_results.csv
```csv
result_id,anonymized_id,attempt_number,academic_score,test_score,achievement_score,essay_score,total_score,explanation,reasoning,rubric_adherence,timestamp
```

### phase1_judge_results.csv
```csv
judge_id,result_id,anonymized_id,worker_result_id,decision,bias_detected,quality_score,feedback,reasoning,timestamp
```

### phase1_final_scores.csv
```csv
anonymized_id,final_score,academic_score,test_score,achievement_score,essay_score,explanation,strengths,areas_for_improvement,timestamp,hash
```

### audit_log.csv
```csv
log_id,timestamp,entity_type,entity_id,action,actor,details,metadata,previous_hash,current_hash
```

### hash_chain.csv
```csv
chain_id,anonymized_id,decision_type,data_json,data_hash,previous_hash,timestamp
```

## LangGraph State Machine

### States
1. **ApplicationSubmitted**: Initial state after intake
2. **IdentityScrubbing**: PII removal and anonymization
3. **WorkerEvaluation**: Merit scoring by Worker LLM
4. **JudgeReview**: Validation by Judge LLM
5. **DecisionGate**: Conditional routing (approve/retry)
6. **FinalScoring**: Score aggregation and ranking
7. **HashGeneration**: Audit trail creation
8. **Notification**: Email sending
9. **Completed**: Terminal state

### State Transitions
- ApplicationSubmitted → IdentityScrubbing
- IdentityScrubbing → WorkerEvaluation
- WorkerEvaluation → JudgeReview
- JudgeReview → DecisionGate
- DecisionGate → WorkerEvaluation (if rejected, attempt < 3)
- DecisionGate → FinalScoring (if approved)
- DecisionGate → Failed (if rejected, attempt >= 3)
- FinalScoring → HashGeneration
- HashGeneration → Notification
- Notification → Completed

### State Data
```python
{
    "application_id": str,
    "anonymized_id": str | None,
    "worker_attempt": int,
    "worker_result": dict | None,
    "judge_result": dict | None,
    "final_score": dict | None,
    "hash": str | None,
    "status": str,
    "error": str | None
}
```

## Identity Scrubbing Algorithm

### PII Detection Rules
1. **Names**: Regex + NER for person/family/institution names
2. **Contact Info**: Email, phone, address patterns
3. **Identifiers**: National IDs, passport numbers
4. **Demographics**: Gender markers, ethnicity, religion
5. **Locations**: Cities, regions, specific schools
6. **Dates**: Birth dates, specific event dates

### Scrubbing Strategy
- **Structured fields**: Direct removal (name, email, phone, address)
- **Text fields (essay/achievements)**:
  - NER-based redaction with `[REDACTED]` placeholders
  - Preserve academic content, remove personal identifiers
  - Pattern matching for residual PII

### Anonymized ID Generation
Format: `ANON_{timestamp_ms}_{random_alphanumeric_6}`
Example: `ANON_1704067200000_A7K9M2`

## Worker-Judge Prompts

### Worker LLM Prompt Structure
```
ROLE: University admissions merit evaluator
CONTEXT: Anonymized application with academic data only
TASK: Evaluate applicant across 4 dimensions:
  - Academic Performance (0-100): GPA, coursework rigor
  - Test Scores (0-100): Standardized test results
  - Achievements (0-100): Awards, competitions, projects
  - Essay Quality (0-100): Writing, critical thinking, motivation

CONSTRAINTS:
  - Ignore any residual demographic information
  - Focus solely on merit indicators
  - Do not penalize for lack of privileged opportunities
  - Evaluate essay content, not writing style influenced by background

OUTPUT FORMAT: Structured JSON with scores and explanations
```

### Judge LLM Prompt Structure
```
ROLE: Quality and bias validator
CONTEXT: Worker evaluation and original anonymized application
TASK: Validate Worker's assessment for:
  - Bias detection: Any demographic assumptions or stereotyping
  - Rubric adherence: Scores aligned with criteria
  - Reasoning quality: Logical, evidence-based explanations
  - Consistency: Fair comparison to standard

DECISION:
  - APPROVE: Evaluation is fair, accurate, and well-justified
  - REJECT: Provide specific feedback for Worker to retry

OUTPUT FORMAT: Structured JSON with decision and feedback
```

## Hash Chain Implementation

### Algorithm
```python
def generate_hash(data: dict, previous_hash: str) -> str:
    """Generate SHA-256 hash linking to previous decision"""
    data_json = json.dumps(data, sort_keys=True)
    hash_input = f"{data_json}|{previous_hash}"
    return hashlib.sha256(hash_input.encode()).hexdigest()
```

### Verification
```python
def verify_chain(hash_chain: list[dict]) -> bool:
    """Verify integrity of entire hash chain"""
    for i in range(1, len(hash_chain)):
        current = hash_chain[i]
        expected_hash = generate_hash(
            current['data'],
            hash_chain[i-1]['data_hash']
        )
        if current['data_hash'] != expected_hash:
            return False
    return True
```

## Error Handling & Resilience

### Idempotency
- Check for existing records before processing
- Use application_id/anonymized_id as deduplication keys
- Skip already-processed applications

### Atomic CSV Operations
```python
# Write to temporary file, then atomic rename
with tempfile.NamedTemporaryFile(delete=False) as tmp:
    writer.writerows(data)
    tmp.flush()
    os.fsync(tmp.fileno())
os.replace(tmp.name, target_csv)  # Atomic on POSIX
```

### LLM API Retry Logic
- Exponential backoff: 1s, 2s, 4s, 8s
- Max 5 retries for transient failures
- Rate limiting: respect API quotas

### Transaction Logging
```python
# Before mutation
log_action("BEFORE_UPDATE", entity_id, current_state)
# Perform mutation
update_csv(entity_id, new_state)
# After mutation
log_action("AFTER_UPDATE", entity_id, new_state)
```

## Configuration Management

### Environment Variables
```bash
# .env file
OPENAI_API_KEY=sk-...
WORKER_MODEL=gpt-5
JUDGE_MODEL=gpt-5-mini

# NOTE: GPT-5 series does not support these parameters - kept for compatibility only
TEMPERATURE=0.1
MAX_TOKENS=4096

MAX_RETRY_ATTEMPTS=3
DATA_DIR=./data
PROMPT_DIR=./prompts
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_FROM=noreply@enigma.edu
EMAIL_PASSWORD=...
```

### Runtime Configuration
```python
# config/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    worker_model: str = "gpt-5"
    judge_model: str = "gpt-5-mini"
    temperature: float = 0.1
    max_retry_attempts: int = 3
    data_dir: Path = Path("./data")
    prompt_dir: Path = Path("./prompts")

    class Config:
        env_file = ".env"
```

## Security Considerations

1. **API Key Management**: Environment variables, never committed
2. **PII Protection**: Encrypted identity mapping, separate storage
3. **Access Control**: File permissions (600) on sensitive CSVs
4. **Input Validation**: Pydantic schemas at all boundaries
5. **Audit Logging**: Immutable append-only logs with timestamps
6. **Rate Limiting**: Prevent abuse of application submission

## Performance Considerations

- **Batch Processing**: Process multiple applications in parallel
- **Async LLM Calls**: Use async/await for concurrent API requests
- **CSV Indexing**: Build in-memory index for fast lookups
- **Caching**: Cache loaded prompts and configurations

## Testing Strategy

1. **Unit Tests**: Each service independently
2. **Integration Tests**: CSV read/write, LLM mocking
3. **End-to-End Tests**: Full pipeline with synthetic data
4. **Bias Tests**: Validate scrubbing removes all PII
5. **Hash Chain Tests**: Verify tamper detection

## Deployment

- **Local Development**: Python virtual environment
- **Production**: Cloud Functions (AWS Lambda / GCP Cloud Functions)
- **Data Storage**: Secure cloud storage with encryption at rest
- **Monitoring**: CloudWatch / Stackdriver for logs and metrics

## Next Steps

1. Set up project structure
2. Implement data schemas
3. Build CSV utilities
4. Create service modules
5. Implement LangGraph pipeline
6. Write and tune prompts
7. End-to-end testing
8. Documentation and runbooks
