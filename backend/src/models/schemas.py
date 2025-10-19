"""Data models and validation schemas for ENIGMA Phase 1."""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
import uuid


# Enums

class ApplicationStatus(str, Enum):
    """Application processing status aligned with batch workflow."""
    SUBMITTED = "submitted"              # Phase 1: Initial submission
    FINALIZED = "finalized"              # Phase 2: Data freeze complete
    PREPROCESSING = "preprocessing"      # Phase 3: Computing deterministic metrics
    BATCH_READY = "batch_ready"          # Phase 4: Ready for LLM batch
    PROCESSING = "processing"            # Phase 5: LLM batch in progress
    SCORED = "scored"                    # Phase 6: LLM scores integrated
    SELECTED = "selected"                # Phase 7: Top-K selection complete
    NOT_SELECTED = "not_selected"        # Phase 7: Not selected
    PUBLISHED = "published"              # Phase 8: Results published to student
    FAILED = "failed"                    # Error state


class AdmissionPhase(str, Enum):
    """Admission cycle workflow phases."""
    SUBMISSION = "submission"            # Phase 1: Accepting applications
    FROZEN = "frozen"                    # Phase 2: Data locked, no more submissions
    PREPROCESSING = "preprocessing"      # Phase 3: Computing deterministic metrics
    BATCH_PREP = "batch_prep"            # Phase 4: Exporting JSONL
    PROCESSING = "processing"            # Phase 5: LLM batch running
    SCORED = "scored"                    # Phase 6: Results integrated
    SELECTION = "selection"              # Phase 7: Top-K selection
    PUBLISHED = "published"              # Phase 8: Results available to students
    COMPLETED = "completed"              # Phase 9: Cycle fully closed


class BatchType(str, Enum):
    """Type of batch processing run."""
    WORKER_EVALUATION = "worker_evaluation"
    JUDGE_REVIEW = "judge_review"


class BatchStatus(str, Enum):
    """Status of a batch processing run."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdminRole(str, Enum):
    """Admin user roles for RBAC."""
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    AUDITOR = "auditor"


class AuditAction(str, Enum):
    """Audit log action types."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EVALUATE = "evaluate"
    FINALIZE = "finalize"
    SELECT = "select"
    PUBLISH = "publish"
    LOGIN = "login"
    LOGOUT = "logout"


class JudgeDecision(str, Enum):
    """Judge validation decision."""
    APPROVED = "approved"
    REJECTED = "rejected"


class InterviewStatus(str, Enum):
    """Interview status enum."""
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Base Models


class StudentStatus(str, Enum):
    """Student account lifecycle status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class StudentAccount(BaseModel):
    """Student identity derived from OAuth providers."""

    model_config = ConfigDict(validate_assignment=True)

    student_id: str = Field(default_factory=lambda: f"STU_{uuid.uuid4().hex[:8].upper()}")
    primary_email: EmailStr
    display_name: Optional[str] = None
    status: StudentStatus = Field(default=StudentStatus.ACTIVE)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    verified_at: Optional[datetime] = None


class OAuthIdentity(BaseModel):
    """Linked OAuth identity record (Google, etc.)."""

    model_config = ConfigDict(validate_assignment=True)

    identity_id: Optional[int] = None
    student_id: str
    provider: str = Field(..., description="OAuth provider name, e.g., 'google'")
    provider_sub: str = Field(..., description="Provider subject identifier")
    email: EmailStr
    email_verified: bool = True
    raw_profile: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StudentSession(BaseModel):
    """Authenticated session bound to HttpOnly cookies."""

    model_config = ConfigDict(validate_assignment=True)

    session_id: str
    student_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active_at: datetime = Field(default_factory=datetime.utcnow)
    revoked: bool = False


class Application(BaseModel):
    """Raw application submitted by applicant."""
    model_config = ConfigDict(validate_assignment=True)

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
    essay: str = Field(..., min_length=100, max_length=5000, description="Application essay")
    achievements: str = Field(
        ...,
        min_length=10,
        max_length=3000,
        description="Awards, competitions, projects, extracurriculars"
    )

    # Metadata
    status: ApplicationStatus = Field(default=ApplicationStatus.SUBMITTED)
    student_id: Optional[str] = Field(
        default=None,
        description="Linked student account when submitted via OAuth session",
    )

    @field_validator('test_scores')
    @classmethod
    def validate_test_scores(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Ensure test scores are valid."""
        if not v:
            raise ValueError("At least one test score is required")
        for test_name, score in v.items():
            if score < 0:
                raise ValueError(f"Test score for {test_name} cannot be negative")
        return v


class AnonymizedApplication(BaseModel):
    """Identity-scrubbed application for AI evaluation."""
    model_config = ConfigDict(validate_assignment=True)

    anonymized_id: str = Field(
        default_factory=lambda: f"ANON_{int(datetime.utcnow().timestamp() * 1000)}_{uuid.uuid4().hex[:6].upper()}"
    )
    application_id: str  # Reference to original

    # Merit data (scrubbed of PII)
    gpa: float = Field(..., ge=0.0, le=4.0)
    test_scores: Dict[str, float]
    essay_scrubbed: str = Field(..., min_length=50, description="PII-removed essay")
    achievements_scrubbed: str = Field(..., min_length=10, description="PII-removed achievements")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WorkerResult(BaseModel):
    """Worker LLM evaluation output."""
    model_config = ConfigDict(validate_assignment=True)

    result_id: str = Field(default_factory=lambda: f"WKR_{uuid.uuid4().hex[:8].upper()}")
    anonymized_id: str
    attempt_number: int = Field(..., ge=1, le=10, description="Evaluation attempt (1-indexed)")

    # Scores (0-100 scale)
    academic_score: float = Field(..., ge=0.0, le=100.0, description="GPA and coursework evaluation")
    test_score: float = Field(..., ge=0.0, le=100.0, description="Standardized test evaluation")
    achievement_score: float = Field(..., ge=0.0, le=100.0, description="Awards and projects evaluation")
    essay_score: float = Field(..., ge=0.0, le=100.0, description="Essay quality evaluation")
    total_score: float = Field(..., ge=0.0, le=100.0, description="Weighted average score")

    # Explanations
    explanation: str = Field(..., min_length=50, description="Overall evaluation explanation")
    reasoning: Dict[str, str] = Field(
        ...,
        description="Category-specific reasoning: {'academic': '...', 'test': '...', ...}"
    )
    rubric_adherence: str = Field(
        ...,
        min_length=20,
        description="Explanation of how rubric was applied"
    )

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = None

    @field_validator('total_score')
    @classmethod
    def validate_total_score(cls, v: float, info) -> float:
        """Ensure total_score is reasonable average of component scores."""
        # This is a simplified check; actual weighting may differ
        if hasattr(info, 'data'):
            data = info.data
            avg = (
                data.get('academic_score', 0) +
                data.get('test_score', 0) +
                data.get('achievement_score', 0) +
                data.get('essay_score', 0)
            ) / 4
            if abs(v - avg) > 20:  # Allow some flexibility for weighting
                raise ValueError(f"total_score {v} seems inconsistent with component scores (avg: {avg})")
        return v


class JudgeResult(BaseModel):
    """Judge LLM validation output."""
    model_config = ConfigDict(validate_assignment=True)

    judge_id: str = Field(default_factory=lambda: f"JDG_{uuid.uuid4().hex[:8].upper()}")
    result_id: str  # Reference to WorkerResult
    anonymized_id: str
    worker_result_id: str  # For traceability

    # Decision
    decision: JudgeDecision
    bias_detected: bool = Field(..., description="Whether bias indicators were found")
    quality_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Quality assessment of Worker's evaluation (0-100)"
    )

    # Feedback
    feedback: str = Field(
        ...,
        min_length=20,
        description="Specific feedback for Worker (especially if rejected)"
    )
    reasoning: str = Field(
        ...,
        min_length=50,
        description="Detailed reasoning for decision"
    )

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = None


class FinalScore(BaseModel):
    """Final aggregated score with LLM results."""
    model_config = ConfigDict(validate_assignment=True)

    score_id: int
    anonymized_id: str

    # Final scores
    final_score: float = Field(..., ge=0.0, le=100.0, description="Approved total score")
    academic_score: float = Field(..., ge=0.0, le=100.0)
    test_score: float = Field(..., ge=0.0, le=100.0)
    achievement_score: float = Field(..., ge=0.0, le=100.0)
    essay_score: float = Field(..., ge=0.0, le=100.0)

    # LLM-generated fields (Phase 6)
    llm_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Score from batch LLM evaluation")
    llm_explanation: Optional[str] = Field(None, description="Explanation from batch LLM")

    # Explanations
    explanation: str = Field(..., min_length=50, description="Comprehensive evaluation summary")
    strengths: List[str] = Field(..., min_items=1, description="Key strengths identified")
    areas_for_improvement: List[str] = Field(
        ...,
        min_items=1,
        description="Constructive feedback areas"
    )

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    hash: Optional[str] = Field(None, description="SHA-256 hash for audit trail")
    worker_attempts: int = Field(..., ge=1, description="Number of worker attempts before approval")
    status: ApplicationStatus = Field(default=ApplicationStatus.SCORED, description="Selection status")


class AuditLog(BaseModel):
    """Audit log entry model."""
    model_config = ConfigDict(validate_assignment=True)

    log_id: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Actor details
    entity_type: str = Field(..., description="Type of entity (Application, AdminUser, etc.)")
    entity_id: str = Field(..., description="ID of the entity (application_id, admin_id, etc.)")

    # Action details
    action: AuditAction = Field(..., description="Action performed")
    actor: str = Field(..., description="Who/what performed the action (system, admin_id, worker_llm, judge_llm)")

    # Additional context
    details: Optional[Dict[str, Any]] = Field(None, description="Action-specific details")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    # Hash chain
    previous_hash: Optional[str] = Field(None, description="Hash of previous log entry")
    current_hash: Optional[str] = Field(None, description="Hash of this log entry")


# State Machine Models

class PipelineState(BaseModel):
    """LangGraph state for Phase 1 pipeline."""
    model_config = ConfigDict(validate_assignment=True, arbitrary_types_allowed=True)

    # Primary identifiers
    application_id: str
    anonymized_id: Optional[str] = None

    # Retry tracking
    worker_attempt: int = Field(default=0, ge=0, le=10)
    max_attempts: int = Field(default=3, ge=1, le=10)

    # Stage results
    application_data: Optional[Application] = None
    anonymized_data: Optional[AnonymizedApplication] = None
    worker_result: Optional[WorkerResult] = None
    judge_result: Optional[JudgeResult] = None
    final_score: Optional[FinalScore] = None

    # Hash chain
    hash: Optional[str] = None

    # Status tracking
    status: ApplicationStatus = Field(default=ApplicationStatus.SUBMITTED)
    error: Optional[str] = None

    # Timestamps
    started_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Response Models for API

class EvaluationResponse(BaseModel):
    """Response model for evaluation status queries."""
    application_id: str
    anonymized_id: Optional[str] = None
    status: ApplicationStatus
    current_score: Optional[float] = None
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class VerificationResponse(BaseModel):
    """Response model for hash chain verification."""
    anonymized_id: str
    is_valid: bool
    hash: str
    verification_details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Admin Portal Models

class DeterministicMetrics(BaseModel):
    """Pre-computed deterministic metrics for Phase 3."""
    model_config = ConfigDict(validate_assignment=True)

    metric_id: int
    application_id: str
    test_average: float = Field(..., ge=0.0, description="Average of all test scores")
    academic_score_computed: float = Field(..., ge=0.0, le=100.0, description="GPA normalized to 0-100")
    percentile_rank: Optional[float] = Field(None, ge=0.0, le=100.0, description="Percentile within cohort")
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class BatchRun(BaseModel):
    """LLM batch processing run tracking."""
    model_config = ConfigDict(validate_assignment=True)

    batch_id: int
    admission_cycle_id: str
    batch_type: BatchType
    model_name: str = Field(..., description="e.g., gpt-5, gpt-5-mini")
    model_version: Optional[str] = None
    input_file_path: str = Field(..., description="Path to input JSONL file")
    output_file_path: Optional[str] = None
    total_records: int = Field(..., ge=0)
    processed_records: int = Field(default=0, ge=0)
    failed_records: int = Field(default=0, ge=0)
    status: BatchStatus = Field(default=BatchStatus.PENDING)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    triggered_by: str = Field(..., description="Admin ID who triggered the batch")
    error_log: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SelectionLog(BaseModel):
    """Top-K selection audit log for Phase 7."""
    model_config = ConfigDict(validate_assignment=True)

    selection_id: int
    admission_cycle_id: str
    program_name: Optional[str] = Field(None, description="For multi-program institutions")
    selected_count: int = Field(..., ge=0)
    selection_criteria: Dict[str, Any] = Field(..., description="Top-K algorithm details")
    cutoff_score: float = Field(..., description="Minimum score for selection")
    executed_at: datetime = Field(default_factory=datetime.utcnow)
    executed_by: str = Field(..., description="Admin ID who executed selection")


class AdmissionCycle(BaseModel):
    """Admission cycle configuration with phase tracking."""
    model_config = ConfigDict(from_attributes=True, validate_assignment=True)

    cycle_id: str = Field(default_factory=lambda: f"CYC_{uuid.uuid4().hex[:8].upper()}")
    cycle_name: str = Field(..., min_length=3, max_length=100, description="e.g., 'Fall 2025 Admissions'")
    phase: AdmissionPhase = Field(default=AdmissionPhase.SUBMISSION, description="Current workflow phase")
    is_open: bool = Field(default=False, description="Whether admissions are currently open")
    max_seats: int = Field(..., gt=0, description="Maximum number of admissions")
    current_seats: int = Field(default=0, ge=0, description="Current number of applications")
    selected_count: int = Field(default=0, ge=0, description="Number of selected applicants")
    result_date: datetime = Field(..., description="When results will be announced")
    start_date: datetime = Field(..., description="Admission window start")
    end_date: datetime = Field(..., description="Admission window end")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(..., description="Admin username who created this cycle")
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None

    @field_validator('end_date')
    @classmethod
    def validate_dates(cls, v: datetime, info) -> datetime:
        """Ensure end_date is after start_date."""
        if hasattr(info, 'data') and 'start_date' in info.data:
            if v <= info.data['start_date']:
                raise ValueError("end_date must be after start_date")
        return v


class AdminUser(BaseModel):
    """Admin user account with RBAC."""
    model_config = ConfigDict(validate_assignment=True)

    admin_id: str = Field(default_factory=lambda: f"ADM_{uuid.uuid4().hex[:8].upper()}")
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    password_hash: str = Field(..., description="bcrypt hashed password")
    email: EmailStr
    role: AdminRole = Field(default=AdminRole.ADMIN, description="User role for RBAC")
    is_active: bool = Field(default=True, description="Account active status")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None


class AdminSession(BaseModel):
    """Admin session for authentication."""
    model_config = ConfigDict(validate_assignment=True)

    session_id: str = Field(default_factory=lambda: f"SES_{uuid.uuid4().hex[:8].upper()}")
    admin_id: str
    token: str = Field(..., description="JWT token")
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    revoked: bool = Field(default=False, description="Whether session has been revoked")


# Admin API Request/Response Models

class AdminLoginRequest(BaseModel):
    """Admin login request."""
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    """Admin login response."""
    success: bool
    token: str
    admin_id: str
    username: str
    email: str
    role: str
    expires_at: datetime


class InterviewCreate(BaseModel):
    """Request model for scheduling an interview."""
    application_id: str
    interview_time: datetime


class InterviewUpdate(BaseModel):
    """Request model for updating an interview."""
    interview_time: Optional[datetime] = None
    interview_link: Optional[str] = Field(None, min_length=10, max_length=500)
    status: Optional[InterviewStatus] = None
    notes: Optional[str] = None


class InterviewDetails(BaseModel):
    """Response model for interview details."""
    id: int
    application_id: str
    student_id: str
    admin_id: str
    admission_cycle_id: str
    interview_time: datetime
    interview_link: str
    status: InterviewStatus
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateCycleRequest(BaseModel):
    """Request to create admission cycle."""
    cycle_name: str = Field(..., min_length=3, max_length=100)
    max_seats: int = Field(..., gt=0)
    result_date: datetime
    start_date: datetime
    end_date: datetime


class UpdateCycleRequest(BaseModel):
    """Request to update admission cycle."""
    cycle_name: Optional[str] = Field(None, min_length=3, max_length=100)
    max_seats: Optional[int] = Field(None, gt=0)
    result_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AdmissionInfoResponse(BaseModel):
    """Public admission information."""
    is_open: bool
    cycle_name: Optional[str] = None
    seats_available: Optional[int] = None
    max_seats: Optional[int] = None
    current_seats: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    result_date: Optional[datetime] = None
    message: str


# ============================================================================
# Bias Monitoring Schemas (Phase 2: Live Interview Monitoring)
# ============================================================================


class SpeakerEnum(str, Enum):
    """Speaker identification in interview transcripts."""
    ADMIN = "admin"
    STUDENT = "student"


class BiasTypeEnum(str, Enum):
    """Types of bias that can be detected in evaluator behavior."""
    APPEARANCE = "appearance"
    GENDER = "gender"
    ACCENT = "accent"
    SOCIOECONOMIC = "socioeconomic"
    NAME = "name"
    PERSONAL_CONNECTION = "personal_connection"
    IRRELEVANT_FACTOR = "irrelevant_factor"


class SeverityEnum(str, Enum):
    """Severity levels for bias detection."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NudgeTypeEnum(str, Enum):
    """Types of nudges delivered to admins."""
    INFO = "info"       # Informational banner (blue)
    WARNING = "warning" # Warning alert (yellow)
    BLOCK = "block"     # Interview blocked (red)


class RecommendedActionEnum(str, Enum):
    """Recommended actions based on bias analysis."""
    NONE = "none"
    NUDGE = "nudge"
    WARN = "warn"
    BLOCK = "block"


class AdminStatusEnum(str, Enum):
    """Admin status for bias management."""
    ACTIVE = "active"
    WARNED = "warned"
    SUSPENDED = "suspended"
    BANNED = "banned"


# Request Models

class TranscriptChunkRequest(BaseModel):
    """Request to store a transcript chunk."""
    interview_id: int
    speaker: SpeakerEnum
    transcript_text: str = Field(..., min_length=1, max_length=10000)
    start_time: datetime
    end_time: datetime
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class BiasAnalysisRequest(BaseModel):
    """Request to analyze a transcript for bias."""
    transcript_id: int
    interview_id: int
    admin_id: str
    transcript_text: str
    conversation_context: Optional[List[str]] = Field(
        default=None,
        description="Previous transcript chunks for context"
    )


# Response Models

class TranscriptChunkResponse(BaseModel):
    """Response containing transcript chunk data."""
    id: int
    interview_id: int
    speaker: str
    transcript_text: str
    start_time: datetime
    end_time: datetime
    confidence_score: Optional[float]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BiasAnalysisResponse(BaseModel):
    """Response containing bias analysis results."""
    id: int
    transcript_id: int
    interview_id: int
    admin_id: str
    bias_detected: bool
    bias_types: Optional[List[str]] = None
    severity: str
    confidence_score: float
    evidence_quotes: Optional[List[str]] = None
    context_summary: Optional[str] = None
    recommended_action: str
    llm_model: str
    analyzed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveNudgeResponse(BaseModel):
    """Response containing nudge data."""
    id: int
    interview_id: int
    nudge_type: str
    message: str
    display_duration: Optional[int] = None
    acknowledged: bool
    dismissed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BiasFlagResponse(BaseModel):
    """Response containing bias flag data."""
    id: int
    interview_id: int
    admin_id: str
    application_id: Optional[str] = None
    flag_type: str
    severity: str
    description: str
    action_taken: str
    automatic: bool
    reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    resolution: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DriftMetricsResponse(BaseModel):
    """Response containing evaluator drift metrics."""
    id: int
    admin_id: str
    admission_cycle_id: Optional[int] = None
    period_start: datetime
    period_end: datetime
    total_interviews: int
    bias_incidents: int
    nudges_delivered: int
    warnings_delivered: int
    blocks_triggered: int
    avg_score_given: Optional[float] = None
    score_variance: Optional[float] = None
    harsh_outlier_count: int
    lenient_outlier_count: int
    irr_correlation: Optional[float] = None
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminBiasHistoryResponse(BaseModel):
    """Response containing admin bias history."""
    id: int
    admin_id: str
    total_interviews_conducted: int
    total_bias_incidents: int
    total_blocks_received: int
    current_status: str
    suspension_count: int
    last_incident_date: Optional[datetime] = None
    strikes: int
    strike_reset_date: Optional[datetime] = None
    notes: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
