"""Application submission, status, and results routes."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from src.database.engine import get_db
from src.database.repositories import AdminRepository, ApplicationRepository
from src.database.models import Application, ApplicationStatusEnum
from src.models.schemas import ApplicationStatus
from src.services.application_collector import ApplicationCollector
from src.api.dependencies.auth import get_student_session
from src.api.schemas.api_models import (
    ApplicationSubmitRequest,
    ApplicationSubmitResponse,
    ApplicationStatusResponse,
    ResultsResponse,
    VerifyRequest,
    VerifyResponse,
)
from src.utils.logger import get_logger, AuditLogger

logger = get_logger("api.applications")

router = APIRouter(tags=["Applications"])


@router.post("/applications", response_model=ApplicationSubmitResponse)
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


@router.get("/applications/{application_id}", response_model=ApplicationStatusResponse)
async def get_application_status(application_id: str, db: Session = Depends(get_db)):
    """Get the current status of an application."""
    try:
        app_repo = ApplicationRepository(db)

        # Get application
        application = app_repo.get_by_application_id(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

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


@router.get("/results/{anonymized_id}", response_model=ResultsResponse)
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


@router.post("/verify", response_model=VerifyResponse)
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


@router.get("/verify/chain", response_model=Dict[str, Any])
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
