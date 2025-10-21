"""API-specific Pydantic models for request/response."""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime

from src.models.schemas import InterviewDetails


# ============================================================================
# Application Request/Response Models
# ============================================================================

class ApplicationSubmitRequest(BaseModel):
    """Request model for submitting an application."""
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    gpa: float = Field(..., ge=0.0, le=4.0, description="GPA on 4.0 scale")
    test_scores: Dict[str, float] = Field(..., description="Test scores dict")
    essay: str = Field(..., min_length=100, max_length=5000)
    achievements: str = Field(..., min_length=10, max_length=3000)


class ApplicationSubmitResponse(BaseModel):
    """Response after application submission."""
    success: bool
    application_id: str
    message: str
    status: str
    timestamp: datetime


class ApplicationStatusResponse(BaseModel):
    """Response for application status query."""
    application_id: str
    anonymized_id: Optional[str]
    status: str
    message: str
    timestamp: datetime


class ResultsResponse(BaseModel):
    """Response with final results."""
    anonymized_id: str
    status: str  # SELECTED, NOT_SELECTED, or PUBLISHED
    final_score: float
    academic_score: float
    test_score: float
    achievement_score: float
    essay_score: float
    explanation: str
    strengths: List[str]
    areas_for_improvement: List[str]
    hash: str
    timestamp: datetime
    worker_attempts: int


class VerifyRequest(BaseModel):
    """Request to verify a hash."""
    anonymized_id: str
    expected_hash: str


class VerifyResponse(BaseModel):
    """Response for hash verification."""
    anonymized_id: str
    is_valid: bool
    stored_hash: str
    expected_hash: str
    message: str


class DashboardStatsResponse(BaseModel):
    """Response with dashboard statistics."""
    total_applications: int
    completed_evaluations: int
    average_score: Optional[float]
    score_distribution: Dict[str, int]
    processing_stats: Dict[str, int]
    timestamp: datetime


# ============================================================================
# Student Authentication Models
# ============================================================================

class StudentAuthStartResponse(BaseModel):
    """Response payload for initiating student OAuth."""
    authorization_url: str
    state: str


class StudentAuthCallbackRequest(BaseModel):
    """Request body for the OAuth callback."""
    code: str
    state: str
    code_verifier: str
    redirect_uri: str


class StudentApplicationData(BaseModel):
    """Student's application data."""
    status: ApplicationStatusResponse
    results: Optional[ResultsResponse]


class StudentProfileResponse(BaseModel):
    """Student profile returned when authenticated."""
    student_id: str
    primary_email: EmailStr
    display_name: Optional[str]
    status: str
    application: Optional[StudentApplicationData] = None


class StudentSessionResponse(BaseModel):
    """Response after successful student login."""
    success: bool
    student: StudentProfileResponse


class StudentLogoutResponse(BaseModel):
    """Response after student logout."""
    success: bool
    message: str


class CycleInfo(BaseModel):
    """Cycle information for student applications."""
    cycle_id: str
    cycle_name: str
    start_date: datetime
    end_date: datetime
    result_date: datetime
    phase: str


class StudentApplicationHistory(BaseModel):
    """Application history entry for a student."""
    application_id: str
    cycle: CycleInfo
    status: str
    submitted_at: datetime
    anonymized_id: Optional[str] = None
    results: Optional[ResultsResponse] = None


class StudentApplicationsResponse(BaseModel):
    """Response with all applications for a student."""
    student_id: str
    applications: List[StudentApplicationHistory]
    total_count: int


# ============================================================================
# Admin Models (imported from src.models.schemas)
# ============================================================================
# Note: These are already defined in src/models/schemas.py:
# - AdminLoginRequest
# - AdminLoginResponse
# - CreateCycleRequest
# - UpdateCycleRequest
# - AdmissionCycle
# - AdmissionInfoResponse
# - InterviewCreate
# - InterviewUpdate
# - InterviewDetails
# - InterviewScoreCreate
# - InterviewScoreRead

class ApplicationDetails(BaseModel):
    """Detailed application model for admin view."""
    model_config = ConfigDict(from_attributes=True)

    application_id: str
    student_id: Optional[str] = None
    admission_cycle_id: str
    name: str
    email: EmailStr
    status: str
    timestamp: datetime
    interview: Optional[InterviewDetails] = None


# ============================================================================
# Interview Start & COI Models
# ============================================================================

class StartInterviewRequest(BaseModel):
    """Request model for starting an interview and accepting COI."""
    coi_accepted: bool = Field(..., description="Must be true to start interview")


class StartInterviewResponse(BaseModel):
    """Response after starting an interview."""
    success: bool
    message: str
    interview_id: int
    started_at: datetime


class InterviewStatusResponse(BaseModel):
    """Public response for checking if interview has started."""
    interview_id: int
    started: bool
    started_at: Optional[datetime] = None
