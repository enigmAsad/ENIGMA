"""Data models and validation schemas for ENIGMA Phase 1."""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
import uuid


# Enums

class ApplicationStatus(str, Enum):
    """Application processing status."""
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


class JudgeDecision(str, Enum):
    """Judge validation decision."""
    APPROVED = "approved"
    REJECTED = "rejected"


# Base Models

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
    """Final aggregated Phase 1 score."""
    model_config = ConfigDict(validate_assignment=True)

    anonymized_id: str

    # Final scores
    final_score: float = Field(..., ge=0.0, le=100.0, description="Approved total score")
    academic_score: float = Field(..., ge=0.0, le=100.0)
    test_score: float = Field(..., ge=0.0, le=100.0)
    achievement_score: float = Field(..., ge=0.0, le=100.0)
    essay_score: float = Field(..., ge=0.0, le=100.0)

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


class AuditLog(BaseModel):
    """Audit log entry for all system actions."""
    model_config = ConfigDict(validate_assignment=True)

    log_id: str = Field(default_factory=lambda: f"LOG_{uuid.uuid4().hex[:12].upper()}")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Entity information
    entity_type: str = Field(..., description="Type of entity (Application, WorkerResult, etc.)")
    entity_id: str = Field(..., description="ID of the affected entity")

    # Action details
    action: str = Field(..., description="Action performed (CREATE, UPDATE, DELETE, EVALUATE, etc.)")
    actor: str = Field(..., description="Who/what performed the action (system, worker_llm, judge_llm)")

    # Additional context
    details: Optional[Dict[str, Any]] = Field(None, description="Action-specific details")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    # Hash chain
    previous_hash: Optional[str] = Field(None, description="Hash of previous log entry")
    current_hash: Optional[str] = Field(None, description="Hash of this log entry")


class HashChainEntry(BaseModel):
    """Hash chain entry for tamper-evident logging."""
    model_config = ConfigDict(validate_assignment=True)

    chain_id: str = Field(default_factory=lambda: f"HASH_{uuid.uuid4().hex[:8].upper()}")
    anonymized_id: str

    # Decision data
    decision_type: str = Field(..., description="Type of decision (phase1_final, phase2_final, etc.)")
    data_json: str = Field(..., description="JSON representation of the decision data")

    # Hashing
    data_hash: str = Field(..., description="SHA-256 hash of data_json")
    previous_hash: str = Field(..., description="Hash of previous chain entry")

    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('data_hash', 'previous_hash')
    @classmethod
    def validate_hash_format(cls, v: str) -> str:
        """Ensure hash is valid SHA-256 hex string."""
        if len(v) != 64:
            raise ValueError("Hash must be 64 characters (SHA-256 hex)")
        try:
            int(v, 16)  # Verify it's valid hex
        except ValueError:
            raise ValueError("Hash must be valid hexadecimal string")
        return v.lower()  # Normalize to lowercase


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
