"""FastAPI REST API wrapper for ENIGMA Phase 1 backend."""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import asyncio
import logging

from src.config.settings import get_settings
from src.models.schemas import (
    Application,
    ApplicationStatus,
    AdminUser,
    AdmissionCycle,
    AdminLoginRequest,
    AdminLoginResponse,
    CreateCycleRequest,
    UpdateCycleRequest,
    AdmissionInfoResponse,
)
from src.services.application_collector import ApplicationCollector
from src.services.hash_chain import HashChainGenerator
from src.services.admin_auth import AdminAuthService
from src.services.admin_auth import AdminAuthService
from src.services.phase_manager import PhaseManager
from src.services.batch_processor import BatchProcessingService
from src.database.engine import get_db
from src.database.repositories import AdminRepository, ApplicationRepository, BatchRepository
from src.database.models import BatchTypeEnum
from src.utils.logger import get_logger, AuditLogger
from src.orchestration.phase1_pipeline import run_pipeline
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


# Background task to process application
async def process_application_background(application: Application):
    """Process application in background."""
    try:
        logger.info(f"Starting background processing for {application.application_id}")
        # Run pipeline in executor to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, run_pipeline, application)
        logger.info(f"Completed background processing for {application.application_id}")
    except Exception as e:
        logger.error(f"Background processing failed for {application.application_id}: {e}")


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


@app.post("/applications", response_model=ApplicationSubmitResponse)
async def submit_application(
    request: ApplicationSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit a new application for Phase 1 evaluation.
    Processing happens asynchronously in the background.
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

        # Check if seats available
        if active_cycle.current_seats >= active_cycle.max_seats:
            raise HTTPException(
                status_code=400,
                detail="Admissions are full. No seats available."
            )

        # Initialize services
        audit_logger = AuditLogger()
        app_collector = ApplicationCollector(
            db=db,
            audit_logger=audit_logger
        )

        # Create application object
        app_data = request.model_dump()
        application = app_collector.collect_application(app_data)

        # Increment seat counter
        admin_repo.increment_cycle_seats(active_cycle.cycle_id)

        # Queue for background processing
        background_tasks.add_task(process_application_background, application)

        logger.info(f"Application submitted: {application.application_id} (Cycle: {active_cycle.cycle_name})")

        return ApplicationSubmitResponse(
            success=True,
            application_id=application.application_id,
            message="Application submitted successfully. Processing in background.",
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
        status = application.status
        if status == ApplicationStatus.COMPLETED:
            message = "Evaluation complete. Results available."
        elif status == ApplicationStatus.FAILED:
            message = "Evaluation failed. Please contact support."
        else:
            message = f"Application is being processed: {status}"

        return ApplicationStatusResponse(
            application_id=application_id,
            anonymized_id=anonymized_id,
            status=status,
            message=message,
            timestamp=datetime.utcnow()
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

        return ResultsResponse(
            anonymized_id=anonymized_id,
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
async def get_all_cycles(admin: Dict[str, Any] = Depends(get_current_admin), db: Session = Depends(get_db)):
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

        # Create new cycle
        cycle = admin_repo.create_cycle(
            cycle_id=f"CYC_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            cycle_name=request.cycle_name,
            max_seats=request.max_seats,
            result_date=request.result_date,
            start_date=request.start_date,
            end_date=request.end_date,
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
            update_data["result_date"] = request.result_date
        if request.start_date:
            update_data["start_date"] = request.start_date
        if request.end_date:
            update_data["end_date"] = request.end_date

        cycle = admin_repo.update_cycle(cycle_id, update_data)
        logger.info(f"Updated admission cycle: {cycle_id}")

        return cycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update cycle: {e}")
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
        cycle = admin_repo.close_cycle(cycle_id)

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
        seats_available = active_cycle.current_seats < active_cycle.max_seats

        is_open = active_cycle.is_open and is_in_range and seats_available

        if not is_open:
            if not is_in_range:
                message = "Admissions window is currently closed"
            elif not seats_available:
                message = "Admissions are full - no seats available"
            else:
                message = "Admissions are currently closed"
        else:
            message = "Admissions are open!"

        return AdmissionInfoResponse(
            is_open=is_open,
            cycle_name=active_cycle.cycle_name,
            seats_available=active_cycle.max_seats - active_cycle.current_seats,
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
        seats_available = active_cycle.current_seats < active_cycle.max_seats

        return {
            "is_open": active_cycle.is_open and is_in_range and seats_available
        }

    except Exception as e:
        logger.error(f"Failed to get admission status: {e}")
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
        cycle = phase_mgr.freeze_cycle(cycle_id)

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
            triggered_by=admin["username"]
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
    """Phase 4 → Phase 5: Mark cycle as processing (LLM batch running externally)."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.start_processing(cycle_id)

        logger.info(f"LLM processing started for cycle {cycle_id} by admin {admin["username"]}")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
