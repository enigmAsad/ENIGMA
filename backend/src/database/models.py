"""SQLAlchemy database models for ENIGMA backend.

All models mapped to PostgreSQL tables with proper relationships,
indexes, and constraints for the 9-phase batch processing workflow.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, Index, Enum as SQLEnum, TIMESTAMP, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
import enum

from src.database.base import Base


# Python Enums (mapped to PostgreSQL ENUM types)

class ApplicationStatusEnum(str, enum.Enum):
    """Application status enum."""
    SUBMITTED = "submitted"
    FINALIZED = "finalized"
    PREPROCESSING = "preprocessing"
    BATCH_READY = "batch_ready"
    PROCESSING = "processing"
    SCORED = "scored"
    SELECTED = "selected"
    NOT_SELECTED = "not_selected"
    PUBLISHED = "published"
    FAILED = "failed"


class AdmissionPhaseEnum(str, enum.Enum):
    """Admission cycle phase enum."""
    SUBMISSION = "submission"
    FROZEN = "frozen"
    PREPROCESSING = "preprocessing"
    BATCH_PREP = "batch_prep"
    PROCESSING = "processing"
    SCORED = "scored"
    SELECTION = "selection"
    PUBLISHED = "published"
    COMPLETED = "completed"


class BatchTypeEnum(str, enum.Enum):
    """Batch processing type enum."""
    WORKER_EVALUATION = "worker_evaluation"
    JUDGE_REVIEW = "judge_review"


class BatchStatusEnum(str, enum.Enum):
    """Batch processing status enum."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdminRoleEnum(str, enum.Enum):
    """Admin user role enum."""
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    AUDITOR = "auditor"


class AuditActionEnum(str, enum.Enum):
    """Audit action enum."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EVALUATE = "evaluate"
    FINALIZE = "finalize"
    SELECT = "select"
    PUBLISH = "publish"
    LOGIN = "login"
    LOGOUT = "logout"


class JudgeDecisionEnum(str, enum.Enum):
    """Judge decision enum."""
    APPROVED = "approved"
    REJECTED = "rejected"


# Database Models

class AdmissionCycle(Base):
    """Admission cycle table - manages application periods and phases."""
    __tablename__ = "admission_cycles"

    cycle_id = Column(String(50), primary_key=True)
    cycle_name = Column(String(100), nullable=False)
    phase = Column(SQLEnum(AdmissionPhaseEnum), nullable=False, default=AdmissionPhaseEnum.SUBMISSION)
    is_open = Column(Boolean, nullable=False, default=False)
    max_seats = Column(Integer, nullable=False)
    current_seats = Column(Integer, nullable=False, default=0)
    selected_count = Column(Integer, nullable=False, default=0)
    result_date = Column(TIMESTAMP(timezone=True), nullable=False)
    start_date = Column(TIMESTAMP(timezone=True), nullable=False)
    end_date = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    created_by = Column(String(50), ForeignKey("admin_users.admin_id"), nullable=False)
    closed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    closed_by = Column(String(50), ForeignKey("admin_users.admin_id"), nullable=True)

    # Relationships
    applications = relationship("Application", back_populates="cycle")
    batch_runs = relationship("BatchRun", back_populates="cycle")
    selection_logs = relationship("SelectionLog", back_populates="cycle")
    creator = relationship("AdminUser", foreign_keys=[created_by])
    closer = relationship("AdminUser", foreign_keys=[closed_by])

    # Indexes
    __table_args__ = (
        Index("idx_cycle_open_phase", "is_open", "phase"),
        Index("idx_cycle_dates", "start_date", "end_date"),
    )


class AdminUser(Base):
    """Admin user table - authentication and RBAC."""
    __tablename__ = "admin_users"

    admin_id = Column(String(50), primary_key=True)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    role = Column(SQLEnum(AdminRoleEnum), nullable=False, default=AdminRoleEnum.ADMIN)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    last_login = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    sessions = relationship("AdminSession", back_populates="admin")

    # Indexes
    __table_args__ = (
        Index("idx_admin_username", "username"),
        Index("idx_admin_email", "email"),
    )


class AdminSession(Base):
    """Admin session table - JWT token tracking."""
    __tablename__ = "admin_sessions"

    session_id = Column(String(50), primary_key=True)
    admin_id = Column(String(50), ForeignKey("admin_users.admin_id"), nullable=False)
    token = Column(Text, nullable=False, unique=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    revoked = Column(Boolean, nullable=False, default=False)

    # Relationships
    admin = relationship("AdminUser", back_populates="sessions")

    # Indexes
    __table_args__ = (
        Index("idx_session_token", "token"),
        Index("idx_session_admin_expires", "admin_id", "expires_at"),
    )


class Application(Base):
    """Application table - stores raw student submissions."""
    __tablename__ = "applications"

    application_id = Column(String(50), primary_key=True)
    admission_cycle_id = Column(String(50), ForeignKey("admission_cycles.cycle_id"), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    # PII fields (encrypted in identity_mapping)
    name = Column(Text, nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    # Merit data
    gpa = Column(Float, nullable=False)
    test_scores = Column(JSONB, nullable=False)  # {"SAT": 1450, "ACT": 32}
    essay = Column(Text, nullable=False)
    achievements = Column(Text, nullable=False)

    # Status tracking
    status = Column(SQLEnum(ApplicationStatusEnum), nullable=False, default=ApplicationStatusEnum.SUBMITTED)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    cycle = relationship("AdmissionCycle", back_populates="applications")
    anonymized = relationship("AnonymizedApplication", back_populates="application", uselist=False)
    deterministic_metrics = relationship("DeterministicMetrics", back_populates="application", uselist=False)

    # Indexes
    __table_args__ = (
        Index("idx_app_cycle_status", "admission_cycle_id", "status"),
        Index("idx_app_id", "application_id"),
        Index("idx_app_email", "email"),
    )


class AnonymizedApplication(Base):
    """Anonymized application table - PII-scrubbed data for LLM processing."""
    __tablename__ = "anonymized_applications"

    anonymized_id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.application_id"), nullable=False, unique=True)

    # Merit data (scrubbed)
    gpa = Column(Float, nullable=False)
    test_scores = Column(JSONB, nullable=False)
    essay_scrubbed = Column(Text, nullable=False)
    achievements_scrubbed = Column(Text, nullable=False)

    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="anonymized")
    identity_mapping = relationship("IdentityMapping", back_populates="anonymized", uselist=False)
    worker_results = relationship("WorkerResult", back_populates="anonymized")
    judge_results = relationship("JudgeResult", back_populates="anonymized")
    final_score = relationship("FinalScore", back_populates="anonymized", uselist=False)
    hash_chain = relationship("HashChain", back_populates="anonymized")

    # Indexes
    __table_args__ = (
        Index("idx_anon_app_id", "application_id"),
    )


class IdentityMapping(Base):
    """Identity mapping table - encrypted PII storage."""
    __tablename__ = "identity_mapping"

    mapping_id = Column(Integer, primary_key=True, autoincrement=True)
    anonymized_id = Column(String(50), ForeignKey("anonymized_applications.anonymized_id"), nullable=False, unique=True)
    application_id = Column(String(50), ForeignKey("applications.application_id"), nullable=False, unique=True)
    encrypted_pii = Column(Text, nullable=False)  # Fernet encrypted JSON
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    anonymized = relationship("AnonymizedApplication", back_populates="identity_mapping")

    # Indexes
    __table_args__ = (
        Index("idx_identity_anon", "anonymized_id"),
        Index("idx_identity_app", "application_id"),
    )


class DeterministicMetrics(Base):
    """Deterministic metrics table - Phase 3 pre-computed metrics."""
    __tablename__ = "deterministic_metrics"

    metric_id = Column(Integer, primary_key=True, autoincrement=True)
    application_id = Column(String(50), ForeignKey("applications.application_id"), nullable=False, unique=True)

    test_average = Column(Float, nullable=False)
    academic_score_computed = Column(Float, nullable=False)  # GPA normalized to 0-100
    percentile_rank = Column(Float, nullable=True)  # Within cohort

    computed_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="deterministic_metrics")

    # Indexes
    __table_args__ = (
        Index("idx_metrics_app_id", "application_id"),
    )


class BatchRun(Base):
    """Batch run table - tracks LLM batch processing jobs."""
    __tablename__ = "batch_runs"

    batch_id = Column(Integer, primary_key=True, autoincrement=True)
    admission_cycle_id = Column(String(50), ForeignKey("admission_cycles.cycle_id"), nullable=False)
    batch_type = Column(SQLEnum(BatchTypeEnum), nullable=False)

    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=True)

    input_file_path = Column(Text, nullable=False)
    output_file_path = Column(Text, nullable=True)

    total_records = Column(Integer, nullable=False)
    processed_records = Column(Integer, nullable=False, default=0)
    failed_records = Column(Integer, nullable=False, default=0)

    status = Column(SQLEnum(BatchStatusEnum), nullable=False, default=BatchStatusEnum.PENDING)
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    triggered_by = Column(String(50), ForeignKey("admin_users.admin_id"), nullable=False)
    error_log = Column(Text, nullable=True)
    batch_metadata = Column(JSONB, nullable=True)

    # Relationships
    cycle = relationship("AdmissionCycle", back_populates="batch_runs")
    worker_results = relationship("WorkerResult", back_populates="batch")
    judge_results = relationship("JudgeResult", back_populates="batch")

    # Indexes
    __table_args__ = (
        Index("idx_batch_cycle_type", "admission_cycle_id", "batch_type"),
        Index("idx_batch_status_started", "status", "started_at"),
    )


class WorkerResult(Base):
    """Worker result table - LLM evaluation outputs."""
    __tablename__ = "worker_results"

    result_id = Column(String(50), primary_key=True)
    anonymized_id = Column(String(50), ForeignKey("anonymized_applications.anonymized_id"), nullable=False)
    batch_run_id = Column(Integer, ForeignKey("batch_runs.batch_id"), nullable=True)
    attempt_number = Column(Integer, nullable=False)

    # Scores
    academic_score = Column(Float, nullable=False)
    test_score = Column(Float, nullable=False)
    achievement_score = Column(Float, nullable=False)
    essay_score = Column(Float, nullable=False)
    total_score = Column(Float, nullable=False)

    # Explanations
    explanation = Column(Text, nullable=False)
    reasoning = Column(JSONB, nullable=False)
    rubric_adherence = Column(Text, nullable=False)

    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    model_used = Column(String(100), nullable=True)

    # Relationships
    anonymized = relationship("AnonymizedApplication", back_populates="worker_results")
    batch = relationship("BatchRun", back_populates="worker_results")
    judge_result = relationship("JudgeResult", back_populates="worker_result", uselist=False)

    # Indexes
    __table_args__ = (
        Index("idx_worker_anon_attempt", "anonymized_id", "attempt_number"),
        Index("idx_worker_batch", "batch_run_id"),
    )


class JudgeResult(Base):
    """Judge result table - validation outputs."""
    __tablename__ = "judge_results"

    judge_id = Column(String(50), primary_key=True)
    result_id = Column(String(50), nullable=False)
    anonymized_id = Column(String(50), ForeignKey("anonymized_applications.anonymized_id"), nullable=False)
    worker_result_id = Column(String(50), ForeignKey("worker_results.result_id"), nullable=False)
    batch_run_id = Column(Integer, ForeignKey("batch_runs.batch_id"), nullable=True)

    decision = Column(SQLEnum(JudgeDecisionEnum), nullable=False)
    bias_detected = Column(Boolean, nullable=False)
    quality_score = Column(Float, nullable=False)

    feedback = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=False)

    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    model_used = Column(String(100), nullable=True)

    # Relationships
    anonymized = relationship("AnonymizedApplication", back_populates="judge_results")
    worker_result = relationship("WorkerResult", back_populates="judge_result")
    batch = relationship("BatchRun", back_populates="judge_results")

    # Indexes
    __table_args__ = (
        Index("idx_judge_worker", "worker_result_id"),
        Index("idx_judge_batch", "batch_run_id"),
    )


class FinalScore(Base):
    """Final score table - aggregated results with LLM scores."""
    __tablename__ = "final_scores"

    score_id = Column(Integer, primary_key=True, autoincrement=True)
    anonymized_id = Column(String(50), ForeignKey("anonymized_applications.anonymized_id"), nullable=False, unique=True)

    # Final scores
    final_score = Column(Float, nullable=False)
    academic_score = Column(Float, nullable=False)
    test_score = Column(Float, nullable=False)
    achievement_score = Column(Float, nullable=False)
    essay_score = Column(Float, nullable=False)

    # LLM-generated (Phase 6)
    llm_score = Column(Float, nullable=True)
    llm_explanation = Column(Text, nullable=True)

    # Explanations
    explanation = Column(Text, nullable=False)
    strengths = Column(JSONB, nullable=False)  # Array of strings
    areas_for_improvement = Column(JSONB, nullable=False)

    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    hash = Column(String(64), nullable=True)
    worker_attempts = Column(Integer, nullable=False)
    status = Column(SQLEnum(ApplicationStatusEnum), nullable=False, default=ApplicationStatusEnum.SCORED)

    # Relationships
    anonymized = relationship("AnonymizedApplication", back_populates="final_score")

    # Indexes
    __table_args__ = (
        Index("idx_final_anon", "anonymized_id"),
        Index("idx_final_status", "status"),
    )


class SelectionLog(Base):
    """Selection log table - Phase 7 Top-K selection audit."""
    __tablename__ = "selection_logs"

    selection_id = Column(Integer, primary_key=True, autoincrement=True)
    admission_cycle_id = Column(String(50), ForeignKey("admission_cycles.cycle_id"), nullable=False)
    program_name = Column(String(100), nullable=True)

    selected_count = Column(Integer, nullable=False)
    selection_criteria = Column(JSONB, nullable=False)
    cutoff_score = Column(Float, nullable=False)

    executed_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    executed_by = Column(String(50), ForeignKey("admin_users.admin_id"), nullable=False)

    # Relationships
    cycle = relationship("AdmissionCycle", back_populates="selection_logs")

    # Indexes
    __table_args__ = (
        Index("idx_selection_cycle", "admission_cycle_id"),
    )


class HashChain(Base):
    """Hash chain table - tamper-evident audit trail."""
    __tablename__ = "hash_chain"

    chain_id = Column(Integer, primary_key=True, autoincrement=True)
    anonymized_id = Column(String(50), ForeignKey("anonymized_applications.anonymized_id"), nullable=False)

    decision_type = Column(String(100), nullable=False)
    data_json = Column(Text, nullable=False)

    data_hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=False)

    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    anonymized = relationship("AnonymizedApplication", back_populates="hash_chain")

    # Indexes
    __table_args__ = (
        Index("idx_hash_anon", "anonymized_id"),
        Index("idx_hash_timestamp", "timestamp"),
    )


class AuditLog(Base):
    """Audit log table - comprehensive system action logging."""
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=False)

    action = Column(SQLEnum(AuditActionEnum), nullable=False)
    actor = Column(String(100), nullable=False)

    details = Column(JSONB, nullable=True)
    log_metadata = Column(JSONB, nullable=True)

    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=True)

    # Indexes
    __table_args__ = (
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_timestamp", "timestamp"),
        Index("idx_audit_actor", "actor"),
    )
