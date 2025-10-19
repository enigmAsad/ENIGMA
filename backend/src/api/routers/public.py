"""Public API routes (no authentication required)."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from src.database.engine import get_db
from src.database.repositories import AdminRepository, ApplicationRepository
from src.config.settings import get_settings
from src.api.schemas.api_models import DashboardStatsResponse
from src.models.schemas import AdmissionInfoResponse
from src.utils.logger import get_logger

logger = get_logger("api.public")

router = APIRouter(tags=["Public"])


@router.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "ENIGMA Phase 1 API",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health")
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


@router.get("/admission/info", response_model=AdmissionInfoResponse)
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


@router.get("/admission/status", response_model=Dict[str, Any])
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


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
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
