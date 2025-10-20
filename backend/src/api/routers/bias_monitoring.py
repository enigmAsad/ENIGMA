"""Bias monitoring dashboard routes (Phase 2)."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

from src.database.engine import get_db
from src.api.dependencies.auth import get_current_admin
from src.utils.logger import get_logger

logger = get_logger("api.bias_monitoring")

router = APIRouter(prefix="/admin/bias", tags=["Bias Monitoring"])


@router.get("/flags", response_model=List[Dict[str, Any]])
async def get_bias_flags(
    reviewed: Optional[bool] = None,
    severity: Optional[str] = None,
    admin_id: Optional[str] = None,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get bias flags for review.

    Args:
        reviewed: Filter by reviewed status (None = all, True = reviewed, False = pending)
        severity: Filter by severity (high, critical)
        admin_id: Filter by specific admin
        admin: Current authenticated admin
        db: Database session

    Returns:
        List of bias flags with details
    """
    try:
        from src.database.repositories.bias_repository import BiasFlagRepository
        flag_repo = BiasFlagRepository(db)

        flags = flag_repo.get_all_flags(
            reviewed=reviewed,
            severity=severity,
            admin_id=admin_id,
        )

        return [
            {
                "id": flag.id,
                "interview_id": flag.interview_id,
                "admin_id": flag.admin_id,
                "application_id": flag.application_id,
                "flag_type": flag.flag_type,
                "severity": flag.severity.value,
                "description": flag.description,
                "evidence": flag.evidence,
                "action_taken": flag.action_taken,
                "automatic": flag.automatic,
                "reviewed": flag.reviewed,
                "reviewed_by": flag.reviewed_by,
                "reviewed_at": flag.reviewed_at.isoformat() if flag.reviewed_at else None,
                "resolution": flag.resolution,
                "created_at": flag.created_at.isoformat(),
            }
            for flag in flags
        ]

    except Exception as e:
        logger.error(f"Failed to get bias flags: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/flags/{flag_id}/resolve")
async def resolve_bias_flag(
    flag_id: int,
    resolution: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Mark a bias flag as reviewed and resolved.

    Args:
        flag_id: The flag ID
        resolution: Resolution notes
        admin: Current authenticated admin
        db: Database session

    Returns:
        Updated flag
    """
    try:
        from src.database.repositories.bias_repository import BiasFlagRepository
        flag_repo = BiasFlagRepository(db)

        flag = flag_repo.resolve_flag(
            flag_id=flag_id,
            reviewed_by=admin["admin_id"],
            resolution=resolution,
        )

        if not flag:
            raise HTTPException(status_code=404, detail="Bias flag not found")

        db.commit()

        logger.info(f"Bias flag {flag_id} resolved by {admin['username']}")

        return {
            "id": flag.id,
            "reviewed": flag.reviewed,
            "reviewed_by": flag.reviewed_by,
            "reviewed_at": flag.reviewed_at.isoformat() if flag.reviewed_at else None,
            "resolution": flag.resolution,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve bias flag {flag_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{admin_id}")
async def get_admin_bias_history(
    admin_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get bias history for a specific admin.

    Args:
        admin_id: The admin ID to get history for
        admin: Current authenticated admin
        db: Database session

    Returns:
        Bias history and metrics
    """
    try:
        from src.database.repositories.bias_repository import (
            AdminBiasHistoryRepository,
            BiasAnalysisRepository,
            NudgeRepository,
        )

        history_repo = AdminBiasHistoryRepository(db)
        analysis_repo = BiasAnalysisRepository(db)
        nudge_repo = NudgeRepository(db)

        # Get admin history
        history = history_repo.get_or_create(admin_id)

        # Get recent incidents
        recent_analyses = analysis_repo.get_by_admin(admin_id, limit=10)

        # Get nudge counts by type
        nudge_counts = nudge_repo.count_by_type(admin_id=admin_id)

        return {
            "admin_id": admin_id,
            "total_interviews_conducted": history.total_interviews_conducted,
            "total_bias_incidents": history.total_bias_incidents,
            "total_blocks_received": history.total_blocks_received,
            "current_status": history.current_status.value,
            "strikes": history.strikes,
            "suspension_count": history.suspension_count,
            "last_incident_date": history.last_incident_date.isoformat() if history.last_incident_date else None,
            "strike_reset_date": history.strike_reset_date.isoformat() if history.strike_reset_date else None,
            "nudge_counts": nudge_counts,
            "recent_incidents": [
                {
                    "id": analysis.id,
                    "interview_id": analysis.interview_id,
                    "bias_detected": analysis.bias_detected,
                    "bias_types": analysis.bias_types,
                    "severity": analysis.severity.value,
                    "confidence_score": analysis.confidence_score,
                    "recommended_action": analysis.recommended_action.value,
                    "analyzed_at": analysis.analyzed_at.isoformat(),
                }
                for analysis in recent_analyses
            ],
        }

    except Exception as e:
        logger.error(f"Failed to get admin bias history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_bias_metrics(
    cycle_id: Optional[int] = None,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get evaluator bias metrics and drift analysis.

    Args:
        cycle_id: Optional cycle ID to filter by
        admin: Current authenticated admin
        db: Database session

    Returns:
        Aggregate bias metrics
    """
    try:
        from src.database.repositories.bias_repository import (
            AdminBiasHistoryRepository,
            DriftMetricsRepository,
        )

        history_repo = AdminBiasHistoryRepository(db)
        drift_repo = DriftMetricsRepository(db)

        # Get all admin bias histories
        all_histories = history_repo.get_all_admins()

        # Get drift metrics
        drift_metrics = drift_repo.get_by_cycle(cycle_id) if cycle_id else drift_repo.get_recent(limit=100)

        # Calculate aggregate stats
        total_admins = len(all_histories)
        active_admins = len([h for h in all_histories if h.current_status.value == "active"])
        warned_admins = len([h for h in all_histories if h.current_status.value == "warned"])
        suspended_admins = len([h for h in all_histories if h.current_status.value == "suspended"])
        banned_admins = len([h for h in all_histories if h.current_status.value == "banned"])

        total_incidents = sum(h.total_bias_incidents for h in all_histories)
        total_interviews = sum(h.total_interviews_conducted for h in all_histories)
        incident_rate = (total_incidents / total_interviews * 100) if total_interviews > 0 else 0.0

        return {
            "summary": {
                "total_admins": total_admins,
                "active_admins": active_admins,
                "warned_admins": warned_admins,
                "suspended_admins": suspended_admins,
                "banned_admins": banned_admins,
                "total_incidents": total_incidents,
                "total_interviews": total_interviews,
                "incident_rate": round(incident_rate, 2),
            },
            "admin_risks": [
                {
                    "admin_id": h.admin_id,
                    "current_status": h.current_status.value,
                    "strikes": h.strikes,
                    "total_interviews": h.total_interviews_conducted,
                    "total_incidents": h.total_bias_incidents,
                    "incident_rate": round((h.total_bias_incidents / h.total_interviews_conducted * 100) if h.total_interviews_conducted > 0 else 0.0, 2),
                }
                for h in all_histories
            ],
            "drift_metrics": [
                {
                    "id": metric.id,
                    "admin_id": metric.admin_id,
                    "period_start": metric.period_start.isoformat(),
                    "period_end": metric.period_end.isoformat(),
                    "total_interviews": metric.total_interviews,
                    "bias_incidents": metric.bias_incidents,
                    "risk_score": metric.risk_score,
                    "risk_level": metric.risk_level,
                }
                for metric in drift_metrics
            ],
        }

    except Exception as e:
        logger.error(f"Failed to get bias metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
