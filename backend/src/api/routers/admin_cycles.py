"""Admin admission cycle management routes."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from src.database.engine import get_db
from src.database.repositories import AdminRepository, ApplicationRepository, BatchRepository
from src.database.models import ApplicationStatusEnum
from src.api.dependencies.auth import get_current_admin
from src.models.schemas import (
    AdmissionCycle,
    CreateCycleRequest,
    UpdateCycleRequest,
)
from src.api.schemas.api_models import ApplicationDetails
from src.services.phase_manager import PhaseManager
from src.utils.logger import get_logger, AuditLogger

logger = get_logger("api.admin_cycles")

router = APIRouter(prefix="/admin/cycles", tags=["Admin Cycles"])


@router.get("", response_model=List[AdmissionCycle])
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


@router.post("", response_model=AdmissionCycle)
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


@router.get("/{cycle_id}", response_model=AdmissionCycle)
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


@router.put("/{cycle_id}", response_model=AdmissionCycle)
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


@router.delete("/{cycle_id}")
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


@router.put("/{cycle_id}/open", response_model=AdmissionCycle)
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


@router.put("/{cycle_id}/close", response_model=AdmissionCycle)
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


@router.get("/active/current", response_model=Optional[AdmissionCycle])
async def get_active_cycle_admin(
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get currently active cycle (admin endpoint)."""
    try:
        admin_repo = AdminRepository(db)
        cycle = admin_repo.get_active_cycle()
        return cycle
    except Exception as e:
        logger.error(f"Failed to get active cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{cycle_id}/status", response_model=Dict[str, Any])
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


@router.get("/{cycle_id}/applications", response_model=List[ApplicationDetails])
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
