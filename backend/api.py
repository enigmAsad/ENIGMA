"""FastAPI REST API wrapper for ENIGMA Phase 1 backend."""

from fastapi import FastAPI, HTTPException, Depends, Header, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from src.config.settings import get_settings
from src.models.schemas import (
    Application as ApplicationSchema,
    ApplicationStatus,
    AdminUser,
    AdmissionCycle,
    AdminLoginRequest,
    AdminLoginResponse,
    CreateCycleRequest,
    UpdateCycleRequest,
    AdmissionInfoResponse,
    InterviewCreate,
    InterviewUpdate,
    InterviewDetails,
)
from src.services.application_collector import ApplicationCollector
from src.services.hash_chain import HashChainGenerator
from src.services.admin_auth import AdminAuthService
from src.services.student_auth import StudentAuthService
from src.services.phase_manager import PhaseManager
from src.services.batch_processor import BatchProcessingService
from src.database.engine import get_db
from src.database.repositories import AdminRepository, ApplicationRepository, BatchRepository, InterviewRepository
from src.database.models import Application, BatchTypeEnum, ApplicationStatusEnum
from src.utils.logger import get_logger, AuditLogger
from sqlalchemy.orm import Session

# Initialize
logger = get_logger("api")
app = FastAPI(
    title="ENIGMA Phase 1 API",
    description="AI-powered blind merit screening system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models

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


class StudentAuthStartResponse(BaseModel):
    """Response payload for initiating student OAuth."""

    authorization_url: str
    state: str


class StudentApplicationData(BaseModel):
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


# Student session helpers


def get_student_auth_service(db: Session = Depends(get_db)) -> StudentAuthService:
    return StudentAuthService(db)


def get_student_session(
    session_token: Optional[str] = Cookie(default=None, alias="enigma_student_session"),
    db: Session = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    if not session_token:
        return None
    auth_service = StudentAuthService(db)
    return auth_service.validate_session(session_token)


# Admin Authentication Dependency
async def get_current_admin(authorization: str = Header(None), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Dependency to get current authenticated admin.

    Args:
        authorization: Authorization header (Bearer token)
        db: Database session

    Returns:
        Dict[str, Any]: Authenticated admin user info (dict with admin_id, username, email, role, is_active)

    Raises:
        HTTPException: If authentication fails
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace('Bearer ', '')
    from src.services.admin_auth import AdminAuthService
    auth_service = AdminAuthService(db)
    admin = auth_service.get_current_admin(token)

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return admin


# Background processing removed - using 9-phase batch workflow instead
# Applications are now processed in batches during Phase 3 (preprocessing)
# and Phase 5 (LLM batch processing), not immediately on submission


# Routes

@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "ENIGMA Phase 1 API",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    try:
        settings = get_settings()
        # Test database connection
        try:
            db.execute("SELECT 1")
            db_status = "connected"
        except Exception:
            db_status = "disconnected"

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": db_status,
            "api_configured": bool(settings.openai_api_key)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.post("/auth/student/google/start", response_model=StudentAuthStartResponse)
async def start_student_google_login(
    redirect_uri: str,
    code_challenge: str,
    db: Session = Depends(get_db),
):
    """Initiates the Google OAuth 2.0 login flow with PKCE.

    This endpoint generates a unique state, stores the provided code challenge,
    and returns the Google authorization URL.

    Args:
        redirect_uri: The URI Google will redirect to after authentication.
        code_challenge: The PKCE code challenge generated by the client.
        db: Database session dependency.

    Returns:
        The authorization URL and the state parameter to be used by the client.
    """
    settings = get_settings()
    auth_service = StudentAuthService(db)

    # The client is responsible for the code_verifier; the server only needs the challenge.
    # The service hashes the verifier later during the callback for validation.
    state_payload = auth_service.create_auth_state(
        code_challenge=code_challenge,
        redirect_uri=redirect_uri,
    )

    authorization_url = (
        f"{auth_service.google_authorize_url}?response_type=code"
        f"&client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid%20email%20profile"
        f"&state={state_payload['state']}"
        f"&nonce={state_payload['nonce']}"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
    )

    return StudentAuthStartResponse(
        authorization_url=authorization_url,
        state=state_payload["state"],
    )


class StudentAuthCallbackRequest(BaseModel):
    """Request body for the OAuth callback."""

    code: str
    state: str
    code_verifier: str
    redirect_uri: str


@app.post("/auth/student/google/callback", response_model=StudentSessionResponse)
async def student_google_callback(
    request: StudentAuthCallbackRequest,
    response: Response,
    user_agent: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Handles the Google OAuth callback, exchanges the code for a session."""
    auth_service = get_student_auth_service(db)
    settings = get_settings()

    try:
        session_details = await auth_service.complete_google_login(
            code=request.code,
            state=request.state,
            code_verifier=request.code_verifier,
            redirect_uri=request.redirect_uri,
            ip_address=None,  # TODO: Get client IP if needed
            user_agent=user_agent,
        )

        response.set_cookie(
            key="enigma_student_session",
            value=session_details["session_token"],
            httponly=True,
            secure=not settings.debug,  # Use secure cookies in production
            samesite="lax",
            expires=session_details["session_expires_at"],
        )

        return StudentSessionResponse(
            success=True,
            student=StudentProfileResponse(
                student_id=session_details["student_id"],
                primary_email=session_details["primary_email"],
                display_name=session_details["display_name"],
                status="active",
            ),
        )

    except HTTPException as e:
        logger.warning(f"Student login failed: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during student login: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.get("/auth/student/me", response_model=StudentProfileResponse)
async def get_current_student(
    student_session: Optional[Dict[str, Any]] = Depends(get_student_session)
):
    """Returns the profile of the currently authenticated student."""
    if not student_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # The student_session dictionary now contains the application data.
    # Pydantic will automatically map it to the StudentProfileResponse model.
    return student_session


@app.post("/auth/student/logout", response_model=StudentLogoutResponse)
async def student_logout(
    response: Response,
    session_token: Optional[str] = Cookie(None, alias="enigma_student_session"),
    db: Session = Depends(get_db),
):
    """Logs out the student by revoking the session and clearing the cookie."""
    if session_token:
        auth_service = get_student_auth_service(db)
        auth_service.revoke_session(session_token)

    response.delete_cookie("enigma_student_session")
    return StudentLogoutResponse(success=True, message="Logged out successfully")


@app.get("/auth/student/applications", response_model=StudentApplicationsResponse)
async def get_student_applications(
    student_session: Optional[Dict[str, Any]] = Depends(get_student_session),
    db: Session = Depends(get_db)
):
    """Get all applications for the authenticated student across all cycles."""
    if not student_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    student_id = student_session["student_id"]
    app_repo = ApplicationRepository(db)
    admin_repo = AdminRepository(db)

    # Get all applications for this student
    applications = app_repo.get_by_student_id(student_id)

    # Build response with cycle info and results
    application_history = []

    for app in applications:
        # Get cycle info
        cycle = admin_repo.get_cycle_by_id(app.admission_cycle_id)
        if not cycle:
            continue  # Skip if cycle not found

        # Get anonymized ID if available
        anonymized_id = None
        try:
            anonymized = app_repo.get_anonymized_by_application_id(app.application_id)
            if anonymized:
                anonymized_id = anonymized.anonymized_id
        except Exception:
            pass

        # Get results if available and published
        results = None
        if anonymized_id:
            try:
                final_score = app_repo.get_final_score_by_anonymized_id(anonymized_id)
                if final_score:
                    status_value = final_score.status.value if hasattr(final_score.status, "value") else str(final_score.status)
                    # Only include results if published, selected, or not_selected
                    if status_value.lower() in ['published', 'selected', 'not_selected']:
                        results = ResultsResponse(
                            anonymized_id=anonymized_id,
                            status=status_value,
                            final_score=final_score.final_score,
                            academic_score=final_score.academic_score,
                            test_score=final_score.test_score,
                            achievement_score=final_score.achievement_score,
                            essay_score=final_score.essay_score,
                            explanation=final_score.explanation,
                            strengths=final_score.strengths,
                            areas_for_improvement=final_score.areas_for_improvement,
                            hash=final_score.hash or "",
                            timestamp=final_score.timestamp,
                            worker_attempts=final_score.worker_attempts
                        )
            except Exception as e:
                logger.warning(f"Could not fetch results for {anonymized_id}: {e}")

        # Get application status
        status_value = app.status.value if hasattr(app.status, "value") else str(app.status)

        # Get cycle phase
        phase_value = cycle.phase.value if hasattr(cycle.phase, "value") else str(cycle.phase)

        # Build history entry
        history_entry = StudentApplicationHistory(
            application_id=app.application_id,
            cycle=CycleInfo(
                cycle_id=cycle.cycle_id,
                cycle_name=cycle.cycle_name,
                start_date=cycle.start_date,
                end_date=cycle.end_date,
                result_date=cycle.result_date,
                phase=phase_value
            ),
            status=status_value,
            submitted_at=app.timestamp,
            anonymized_id=anonymized_id,
            results=results
        )
        application_history.append(history_entry)

    return StudentApplicationsResponse(
        student_id=student_id,
        applications=application_history,
        total_count=len(application_history)
    )


@app.get("/student/interviews/me", response_model=List[InterviewDetails])
async def get_student_interviews(
    student_session: Optional[Dict[str, Any]] = Depends(get_student_session),
    db: Session = Depends(get_db),
):
    """Get upcoming and past interviews for the authenticated student."""
    if not student_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        interview_repo = InterviewRepository(db)
        interviews = interview_repo.get_by_student_id(student_session["student_id"])
        return interviews
    except Exception as e:
        logger.error(f"Failed to get interviews for student {student_session['student_id']}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/applications", response_model=ApplicationSubmitResponse)
async def submit_application(
    request: ApplicationSubmitRequest,
    db: Session = Depends(get_db),
    student_session: Optional[Dict[str, Any]] = Depends(get_student_session)
):
    """
    Submit a new application (Phase 1: SUBMISSION).

    Application is stored with PII intact. Identity scrubbing and evaluation
    occur later during Phase 3 (preprocessing) after the admissions window closes.
    """
    try:
        admin_repo = AdminRepository(db)

        # Check if admissions are open
        active_cycle = admin_repo.get_active_cycle()
        if not active_cycle:
            raise HTTPException(
                status_code=400,
                detail="Admissions are currently closed. Please check back later."
            )

        # Check if cycle is actually open
        if not active_cycle.is_open:
            raise HTTPException(
                status_code=400,
                detail="Admissions are currently closed."
            )

        # Check if within date range
        now = datetime.now(timezone.utc)
        if not (active_cycle.start_date <= now <= active_cycle.end_date):
            raise HTTPException(
                status_code=400,
                detail=f"Admissions window is closed. Opens on {active_cycle.start_date.date()}, closes on {active_cycle.end_date.date()}."
            )

        # NOTE: We do NOT limit applications based on max_seats
        # max_seats is for SELECTION (Phase 7 top-K), not application limit
        # Applications are unlimited until admin closes the cycle or date range ends

        # Initialize services
        audit_logger = AuditLogger()
        app_collector = ApplicationCollector(
            db=db,
            audit_logger=audit_logger
        )

        app_data = request.model_dump()

        if student_session:
            student_id = student_session["student_id"]
            app_data["email"] = student_session["primary_email"]
            app_data["student_id"] = student_id

            # Enforce one application per cycle per student
            existing_query = db.query(Application).filter(
                Application.student_id == student_id,
                Application.admission_cycle_id == active_cycle.cycle_id,
            )
            if existing_query.first():
                raise HTTPException(
                    status_code=400,
                    detail="You have already submitted an application for this admission cycle.",
                )

        application = app_collector.collect_application(app_data)

        if student_session:
            # Ensure persisted record links to student account
            application_record = ApplicationRepository(db).get_by_application_id(application.application_id)
            if application_record:
                application_record.student_id = student_session["student_id"]
                db.flush()

        # Increment seat counter
        admin_repo.increment_cycle_seats(active_cycle.cycle_id)

        # No background processing - applications will be evaluated in Phase 3 (preprocessing)
        # and Phase 5 (LLM batch processing) after admissions close

        logger.info(f"Application submitted: {application.application_id} (Cycle: {active_cycle.cycle_name})")

        return ApplicationSubmitResponse(
            success=True,
            application_id=application.application_id,
            message="Application submitted successfully. Your application will be evaluated after the admissions window closes.",
            status=ApplicationStatus.SUBMITTED.value,
            timestamp=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Application submission failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/applications/{application_id}", response_model=ApplicationStatusResponse)
async def get_application_status(application_id: str, db: Session = Depends(get_db)):
    """Get the current status of an application."""
    try:
        app_repo = ApplicationRepository(db)

        # Get application
        application = app_repo.get_by_application_id(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Check for anonymized ID
        anonymized_id = None
        # TODO: Implement anonymized ID lookup when needed

        # Determine status message
        status_enum = application.status
        status_value = status_enum.value if hasattr(status_enum, "value") else str(status_enum)

        status_messages = {
            ApplicationStatus.SUBMITTED.value: "Application received. Our team will begin verification soon.",
            ApplicationStatus.FINALIZED.value: "Admissions window has closed. Preparing applications for evaluation.",
            ApplicationStatus.PREPROCESSING.value: "Deterministic metrics are being calculated for your application.",
            ApplicationStatus.BATCH_READY.value: "Your application is queued for AI evaluation.",
            ApplicationStatus.PROCESSING.value: "Your application is currently being evaluated by our AI reviewers.",
            ApplicationStatus.SCORED.value: "Evaluation results are in. Awaiting final selection.",
            ApplicationStatus.SELECTED.value: "Congratulations! You have been selected. Results will be published soon.",
            ApplicationStatus.NOT_SELECTED.value: "Your application was not selected. Final results will be published soon.",
            ApplicationStatus.PUBLISHED.value: "Results have been published. You can view your evaluation below.",
            ApplicationStatus.FAILED.value: "Evaluation failed. Please contact support for assistance.",
        }

        message = status_messages.get(
            status_value,
            "Your application is progressing through the admissions workflow. Please check back soon."
        )

        # Attempt to fetch anonymized ID when available
        anonymized_id = None
        try:
            anonymized = app_repo.get_anonymized_by_application_id(application_id)
            if anonymized:
                anonymized_id = anonymized.anonymized_id
        except Exception:
            anonymized_id = None

        return ApplicationStatusResponse(
            application_id=application_id,
            anonymized_id=anonymized_id,
            status=status_value,
            message=message,
            timestamp=datetime.now(timezone.utc)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status check failed for {application_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/{anonymized_id}", response_model=ResultsResponse)
async def get_results(anonymized_id: str, db: Session = Depends(get_db)):
    """Get final evaluation results by anonymized ID."""
    try:
        app_repo = ApplicationRepository(db)

        # Get final score
        final_score = app_repo.get_final_score_by_anonymized_id(anonymized_id)
        if not final_score:
            raise HTTPException(
                status_code=404,
                detail="Results not found. Evaluation may still be in progress."
            )

        # Get status value (handle enum or string)
        status_value = final_score.status.value if hasattr(final_score.status, "value") else str(final_score.status)

        return ResultsResponse(
            anonymized_id=anonymized_id,
            status=status_value,
            final_score=final_score.final_score,
            academic_score=final_score.academic_score,
            test_score=final_score.test_score,
            achievement_score=final_score.achievement_score,
            essay_score=final_score.essay_score,
            explanation=final_score.explanation,
            strengths=final_score.strengths,
            areas_for_improvement=final_score.areas_for_improvement,
            hash=final_score.hash or "",
            timestamp=final_score.timestamp,
            worker_attempts=final_score.worker_attempts
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Results retrieval failed for {anonymized_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verify", response_model=VerifyResponse)
async def verify_hash(request: VerifyRequest, db: Session = Depends(get_db)):
    """Verify the integrity of a decision hash."""
    try:
        app_repo = ApplicationRepository(db)

        # Get stored hash for this anonymized_id
        final_score = app_repo.get_final_score_by_anonymized_id(request.anonymized_id)
        if not final_score:
            raise HTTPException(status_code=404, detail="Results not found")

        stored_hash = final_score.hash or ""
        is_valid = stored_hash == request.expected_hash

        return VerifyResponse(
            anonymized_id=request.anonymized_id,
            is_valid=is_valid,
            stored_hash=stored_hash,
            expected_hash=request.expected_hash,
            message="Hash verification successful" if is_valid else "Hash mismatch detected"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hash verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/verify/chain", response_model=Dict[str, Any])
async def verify_entire_chain(db: Session = Depends(get_db)):
    """Verify the integrity of the entire hash chain."""
    try:
        # TODO: Implement hash chain verification with PostgreSQL
        # For now, return a placeholder response
        return {
            "is_valid": True,
            "chain_length": 0,
            "first_entry": None,
            "last_entry": None,
            "invalid_entries": [],
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Hash chain verification not yet implemented for PostgreSQL"
        }

    except Exception as e:
        logger.error(f"Chain verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get aggregate statistics for public dashboard."""
    try:
        app_repo = ApplicationRepository(db)

        # Get counts
        total_applications = app_repo.get_total_count()
        completed_evaluations = app_repo.get_completed_evaluations_count()

        # Calculate average score
        average_score = app_repo.get_average_final_score()

        # Score distribution (by ranges)
        score_distribution = {
            "90-100": 0,
            "80-89": 0,
            "70-79": 0,
            "60-69": 0,
            "below-60": 0
        }

        distribution = app_repo.get_score_distribution()
        score_distribution.update(distribution)

        # Processing stats by status
        processing_stats = app_repo.get_status_distribution()

        return DashboardStatsResponse(
            total_applications=total_applications,
            completed_evaluations=completed_evaluations,
            average_score=average_score,
            score_distribution=score_distribution,
            processing_stats=processing_stats,
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Dashboard stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@app.post("/admin/auth/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    try:
        from src.services.admin_auth import AdminAuthService
        auth_service = AdminAuthService(db)
        result = auth_service.login(request.username, request.password)

        if not result:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


@app.post("/admin/auth/logout")
async def admin_logout(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Admin logout endpoint."""
    return {"success": True, "message": "Logged out successfully"}


@app.get("/admin/auth/me")
async def get_current_admin_info(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Get current admin user info."""
    return {
        "admin_id": admin["admin_id"],
        "username": admin["username"],
        "email": admin["email"],
        "role": admin["role"]
    }


# Admission Cycles
@app.get("/admin/cycles", response_model=List[AdmissionCycle])
async def get_all_cycles(
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all admission cycles."""
    try:
        admin_repo = AdminRepository(db)
        cycles = admin_repo.get_all_cycles()
        return cycles
    except Exception as e:
        logger.error(f"Failed to get cycles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/cycles", response_model=AdmissionCycle)
async def create_cycle(
    request: CreateCycleRequest,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create new admission cycle."""
    try:
        admin_repo = AdminRepository(db)

        # Close any open cycles
        active_cycle = admin_repo.get_active_cycle()
        if active_cycle:
            admin_repo.update_cycle(active_cycle.cycle_id, {"is_open": False})

        # Pydantic already parses datetime strings from the request
        # We just need to ensure they're timezone-aware (add UTC if naive)
        start_date = request.start_date
        end_date = request.end_date
        result_date = request.result_date

        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        if result_date.tzinfo is None:
            result_date = result_date.replace(tzinfo=timezone.utc)

        # Create new cycle
        cycle = admin_repo.create_cycle(
            cycle_id=f"CYC_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            cycle_name=request.cycle_name,
            max_seats=request.max_seats,
            result_date=result_date,
            start_date=start_date,
            end_date=end_date,
            created_by=admin["admin_id"]
        )

        # Automatically open the newly created cycle
        admin_repo.update_cycle(cycle.cycle_id, {"is_open": True})
        cycle.is_open = True  # Update the object to reflect the change

        logger.info(f"Created and opened admission cycle: {cycle.cycle_name}")

        return cycle

    except Exception as e:
        logger.error(f"Failed to create cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/cycles/{cycle_id}", response_model=AdmissionCycle)
async def get_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get admission cycle by ID."""
    try:
        admin_repo = AdminRepository(db)
        cycle = admin_repo.get_cycle_by_id(cycle_id)

        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        return cycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/cycles/{cycle_id}", response_model=AdmissionCycle)
async def update_cycle(
    cycle_id: str,
    request: UpdateCycleRequest,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update admission cycle."""
    try:
        admin_repo = AdminRepository(db)
        cycle = admin_repo.get_cycle_by_id(cycle_id)

        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        # Update fields if provided
        update_data = {}
        if request.cycle_name:
            update_data["cycle_name"] = request.cycle_name
        if request.max_seats:
            update_data["max_seats"] = request.max_seats
        if request.result_date:
            # Pydantic already parsed datetime, just ensure timezone-aware
            result_date = request.result_date
            if result_date.tzinfo is None:
                result_date = result_date.replace(tzinfo=timezone.utc)
            update_data["result_date"] = result_date
        if request.start_date:
            # Pydantic already parsed datetime, just ensure timezone-aware
            start_date = request.start_date
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            update_data["start_date"] = start_date
        if request.end_date:
            # Pydantic already parsed datetime, just ensure timezone-aware
            end_date = request.end_date
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            update_data["end_date"] = end_date

        cycle = admin_repo.update_cycle(cycle_id, update_data)
        logger.info(f"Updated admission cycle: {cycle_id}")

        return cycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/cycles/{cycle_id}")
async def delete_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete an admission cycle that has no dependent records."""
    try:
        admin_repo = AdminRepository(db)
        app_repo = ApplicationRepository(db)
        batch_repo = BatchRepository(db)

        cycle = admin_repo.get_cycle_by_id(cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        if cycle.is_open:
            raise HTTPException(status_code=400, detail="Close the cycle before deleting it.")

        application_count = app_repo.count_by_cycle(cycle_id)
        if application_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete cycle with submitted applications. Archive or remove applications first."
            )

        selection_logs = admin_repo.get_selection_logs(cycle_id)
        if selection_logs:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete cycle with recorded selection logs."
            )

        batch_runs = batch_repo.get_batches_by_cycle(cycle_id)
        if batch_runs:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete cycle with existing batch runs."
            )

        deleted = admin_repo.delete_cycle(cycle_id)
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete cycle")

        audit_logger = AuditLogger(db)
        audit_logger.log_action(
            entity_type="AdmissionCycle",
            entity_id=cycle_id,
            action="delete",
            actor=admin["admin_id"],
            details={
                "cycle_name": cycle.cycle_name,
                "deleted_by": admin["username"],
            }
        )

        logger.info(f"Deleted admission cycle: {cycle.cycle_name} ({cycle_id})")

        return {
            "success": True,
            "message": f"Admission cycle '{cycle.cycle_name}' deleted successfully.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/cycles/{cycle_id}/open", response_model=AdmissionCycle)
async def open_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Open admission cycle."""
    try:
        admin_repo = AdminRepository(db)

        # Close any currently open cycles
        active_cycle = admin_repo.get_active_cycle()
        if active_cycle and active_cycle.cycle_id != cycle_id:
            admin_repo.update_cycle(active_cycle.cycle_id, {"is_open": False})

        # Open the requested cycle
        cycle = admin_repo.open_cycle(cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        logger.info(f"Opened admission cycle: {cycle.cycle_name}")

        return cycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to open cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/cycles/{cycle_id}/close", response_model=AdmissionCycle)
async def close_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Close admission cycle."""
    try:
        admin_repo = AdminRepository(db)
        cycle = admin_repo.close_cycle(cycle_id, admin["admin_id"])

        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        logger.info(f"Closed admission cycle: {cycle.cycle_name}")

        return cycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to close cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/cycles/active/current", response_model=Optional[AdmissionCycle])
async def get_active_cycle_admin(admin: Dict[str, Any] = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Get currently active cycle (admin endpoint)."""
    try:
        admin_repo = AdminRepository(db)
        cycle = admin_repo.get_active_cycle()
        return cycle
    except Exception as e:
        logger.error(f"Failed to get active cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Public admission info (no auth required)
@app.get("/admission/info", response_model=AdmissionInfoResponse)
async def get_admission_info(db: Session = Depends(get_db)):
    """Get public admission information."""
    try:
        admin_repo = AdminRepository(db)
        active_cycle = admin_repo.get_active_cycle()

        if not active_cycle:
            return AdmissionInfoResponse(
                is_open=False,
                message="Admissions are currently closed. Please check back later."
            )

        # Check if within date range
        now = datetime.now(timezone.utc)
        is_in_range = active_cycle.start_date <= now <= active_cycle.end_date

        # NOTE: Applications are unlimited - max_seats is for selection, not admission closure
        is_open = active_cycle.is_open and is_in_range

        if not is_open:
            if not is_in_range:
                message = "Admissions window is currently closed"
            else:
                message = "Admissions are currently closed"
        else:
            message = "Admissions are open!"

        return AdmissionInfoResponse(
            is_open=is_open,
            cycle_name=active_cycle.cycle_name,
            seats_available=None,  # Unlimited applications - max_seats is for selection only
            max_seats=active_cycle.max_seats,
            current_seats=active_cycle.current_seats,
            start_date=active_cycle.start_date,
            end_date=active_cycle.end_date,
            result_date=active_cycle.result_date,
            message=message
        )

    except Exception as e:
        logger.error(f"Failed to get admission info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admission/status", response_model=Dict[str, Any])
async def get_admission_status(db: Session = Depends(get_db)):
    """Check if admissions are open (simple boolean)."""
    try:
        admin_repo = AdminRepository(db)
        active_cycle = admin_repo.get_active_cycle()

        if not active_cycle:
            return {"is_open": False}

        now = datetime.now(timezone.utc)
        is_in_range = active_cycle.start_date <= now <= active_cycle.end_date

        # NOTE: Applications are unlimited - max_seats is for selection, not admission closure
        return {
            "is_open": active_cycle.is_open and is_in_range
        }

    except Exception as e:
        logger.error(f"Failed to get admission status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INTERVIEW MANAGEMENT
# ============================================================================

@app.post("/admin/interviews/schedule", response_model=InterviewDetails)
async def schedule_interview(
    request: InterviewCreate,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Schedule a new interview for a selected applicant."""
    try:
        interview_repo = InterviewRepository(db)
        app_repo = ApplicationRepository(db)

        # Validate that the application exists and is selected
        application = app_repo.get_by_application_id(request.application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Ensure the application has an associated student
        if not application.student_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot schedule interview for an application with no linked student account."
            )

        # Check if interview can be scheduled (e.g., must be in 'selected' status)
        # This logic might need adjustment based on exact workflow requirements
        is_schedulable = application.status == ApplicationStatusEnum.SELECTED
        if not is_schedulable:
            raise HTTPException(
                status_code=400,
                detail=f"Interviews can only be scheduled for selected applicants, but status is '{application.status.value}'",
            )

        # 1. Create interview with a placeholder link
        temp_link = "/interview/pending"
        interview = interview_repo.create_interview(
            application_id=request.application_id,
            student_id=application.student_id,
            admin_id=admin["admin_id"],
            admission_cycle_id=application.admission_cycle_id,
            interview_time=request.interview_time,
            interview_link=temp_link, # Temporary link
        )
        db.flush() # Flush to get the ID

        # 2. Generate the real link and update the record
        final_link = f"/interview/{interview.id}"
        updated_interview = interview_repo.update_interview(
            interview.id, {"interview_link": final_link}
        )
        
        if not updated_interview:
            # This should not happen, but handle it defensively
            raise HTTPException(status_code=500, detail="Failed to update interview link after creation.")

        logger.info(f"Interview {updated_interview.id} scheduled for application {request.application_id} by {admin['username']}")
        return updated_interview

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to schedule interview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@app.get("/admin/interviews/cycle/{cycle_id}", response_model=List[InterviewDetails])
async def get_interviews_for_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all interviews scheduled for a specific admission cycle."""
    try:
        interview_repo = InterviewRepository(db)
        interviews = interview_repo.get_by_cycle_id(cycle_id)
        return interviews
    except Exception as e:
        logger.error(f"Failed to get interviews for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/interviews/{interview_id}", response_model=InterviewDetails)
async def update_interview(
    interview_id: int,
    request: InterviewUpdate,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an existing interview (e.g., add notes, change status)."""
    try:
        interview_repo = InterviewRepository(db)
        interview = interview_repo.update_interview(
            interview_id, request.model_dump(exclude_unset=True)
        )
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        logger.info(f"Interview {interview_id} updated by {admin['username']}")
        return interview
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update interview {interview_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/interviews/{interview_id}", status_code=204)
async def delete_interview(
    interview_id: int,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete an interview."""
    try:
        interview_repo = InterviewRepository(db)
        interview = interview_repo.get_by_id(interview_id)

        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        deleted = interview_repo.delete_interview(interview_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Interview not found during deletion")

        logger.info(f"Interview {interview_id} deleted by {admin['username']}")
        return Response(status_code=204)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete interview {interview_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

@app.get("/admin/cycles/{cycle_id}/applications", response_model=List[ApplicationDetails])
async def get_cycle_applications(
    cycle_id: str,
    status: Optional[ApplicationStatusEnum] = None,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all applications for a cycle, with optional status filter."""
    try:
        app_repo = ApplicationRepository(db)
        apps = app_repo.get_by_cycle(cycle_id, status=status, limit=1000)  # Increase limit for admin view
        return apps
    except Exception as e:
        logger.error(f"Failed to get applications for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PHASE MANAGEMENT ENDPOINTS
# ============================================================================

@app.post("/admin/cycles/{cycle_id}/freeze", response_model=AdmissionCycle)
async def freeze_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 1 → Phase 2: Freeze admission cycle and finalize applications."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.freeze_cycle(cycle_id, closed_by=admin["admin_id"])

        logger.info(f"Cycle {cycle_id} frozen by admin {admin["username"]}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to freeze cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/preprocess", response_model=AdmissionCycle)
async def start_preprocessing(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 2 → Phase 3: Compute deterministic metrics for all applications."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.start_preprocessing(cycle_id)

        logger.info(f"Preprocessing started for cycle {cycle_id} by admin {admin["username"]}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to start preprocessing for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/export", response_model=Dict[str, Any])
async def export_batch_data(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 3 → Phase 4: Export applications to JSONL for LLM batch processing."""
    try:
        phase_mgr = PhaseManager(db)
        batch_service = BatchProcessingService(db)

        # Start batch prep phase
        cycle = phase_mgr.start_batch_prep(cycle_id)

        # Export to JSONL
        file_path, record_count = batch_service.export_applications_to_jsonl(cycle_id)

        # Create batch run record
        batch_id = batch_service.create_batch_run(
            cycle_id=cycle_id,
            batch_type=BatchTypeEnum.WORKER_EVALUATION,
            model_name=get_settings().worker_model,
            input_file_path=file_path,
            total_records=record_count,
            triggered_by=admin["admin_id"]
        )

        result = {
            "cycle_id": cycle_id,
            "file_path": file_path,
            "record_count": record_count,
            "batch_id": batch_id,
            "message": f"Exported {record_count} applications to JSONL for batch processing"
        }

        logger.info(f"Batch export completed for cycle {cycle_id} by admin {admin["username"]}")
        return result

    except Exception as e:
        logger.error(f"Failed to export batch data for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/processing", response_model=AdmissionCycle)
async def start_llm_processing(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 4 → Phase 5: Evaluate BATCH_READY applications with internal LLMs."""
    try:
        phase_mgr = PhaseManager(db)
        batch_service = BatchProcessingService(db)

        cycle = phase_mgr.start_processing(cycle_id)

        batch_service.run_internal_processing(
            cycle_id=cycle_id,
            triggered_by=admin["admin_id"]
        )

        cycle = phase_mgr.mark_scored(cycle_id)

        logger.info(
            f"LLM processing completed for cycle {cycle_id} by admin {admin["username"]}"
        )
        return cycle

    except Exception as e:
        logger.error(f"Failed to start processing for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/batch/{batch_id}/import", response_model=Dict[str, Any])
async def import_llm_results(
    batch_id: int,
    results_file: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 6: Import LLM results from JSONL file and update database."""
    try:
        batch_service = BatchProcessingService(db)
        imported_count = batch_service.import_llm_results_from_jsonl(batch_id, results_file)

        # Mark cycle as scored
        phase_mgr = PhaseManager(db)
        cycle_id = batch_service.batch_repo.get_batch_by_id(batch_id).admission_cycle_id
        cycle = phase_mgr.mark_scored(cycle_id)

        result = {
            "imported_count": imported_count,
            "cycle_id": cycle_id,
            "message": f"Imported {imported_count} LLM results"
        }

        logger.info(f"LLM results imported for batch {batch_id} by admin {admin["username"]}")
        return result

    except Exception as e:
        logger.error(f"Failed to import LLM results for batch {batch_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/select", response_model=Dict[str, Any])
async def perform_selection(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 6 → Phase 7: Perform Top-K selection based on final scores."""
    try:
        phase_mgr = PhaseManager(db)
        result = phase_mgr.perform_selection(cycle_id, admin["admin_id"])

        logger.info(f"Selection performed for cycle {cycle_id} by admin {admin["username"]}")
        return result

    except Exception as e:
        logger.error(f"Failed to perform selection for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/publish", response_model=AdmissionCycle)
async def publish_results(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 7 → Phase 8: Publish results to student portal."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.publish_results(cycle_id)

        logger.info(f"Results published for cycle {cycle_id} by admin {admin["username"]}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to publish results for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/cycles/{cycle_id}/complete", response_model=AdmissionCycle)
async def complete_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 8 → Phase 9: Complete admission cycle."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.complete_cycle(cycle_id, admin["username"])

        logger.info(f"Cycle {cycle_id} completed by admin {admin["username"]}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to complete cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/admin/cycles/{cycle_id}/status", response_model=Dict[str, Any])
async def get_cycle_status(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get comprehensive cycle status including application counts."""
    try:
        phase_mgr = PhaseManager(db)
        status = phase_mgr.get_cycle_status(cycle_id)

        if not status:
            raise HTTPException(status_code=404, detail="Cycle not found")

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get cycle status for {cycle_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/batch/{batch_id}/status", response_model=Dict[str, Any])
async def get_batch_status(
    batch_id: int,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get batch processing status."""
    try:
        batch_service = BatchProcessingService(db)
        status = batch_service.get_batch_status(batch_id)

        if not status:
            raise HTTPException(status_code=404, detail="Batch not found")

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get batch status for {batch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)

    async def broadcast(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/interview/{interview_id}")
async def websocket_endpoint(websocket: WebSocket, interview_id: str):
    await manager.connect(websocket, interview_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data, interview_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, interview_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)