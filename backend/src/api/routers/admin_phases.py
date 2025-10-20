"""Admin phase management routes for 9-phase admission workflow."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from src.database.engine import get_db
from src.database.repositories import BatchRepository
from src.database.models import BatchTypeEnum
from src.config.settings import get_settings
from src.api.dependencies.auth import get_current_admin
from src.models.schemas import AdmissionCycle
from src.services.phase_manager import PhaseManager
from src.services.batch_processor import BatchProcessingService
from src.utils.logger import get_logger

logger = get_logger("api.admin_phases")

router = APIRouter(prefix="/admin", tags=["Admin Phase Management"])


@router.post("/cycles/{cycle_id}/freeze", response_model=AdmissionCycle)
async def freeze_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 1 → Phase 2: Freeze admission cycle and finalize applications."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.freeze_cycle(cycle_id, closed_by=admin["admin_id"])

        logger.info(f"Cycle {cycle_id} frozen by admin {admin['username']}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to freeze cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/preprocess", response_model=AdmissionCycle)
async def start_preprocessing(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 2 → Phase 3: Compute deterministic metrics for all applications."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.start_preprocessing(cycle_id)

        logger.info(f"Preprocessing started for cycle {cycle_id} by admin {admin['username']}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to start preprocessing for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/export", response_model=Dict[str, Any])
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

        logger.info(f"Batch export completed for cycle {cycle_id} by admin {admin['username']}")
        return result

    except Exception as e:
        logger.error(f"Failed to export batch data for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/processing", response_model=AdmissionCycle)
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
            f"LLM processing completed for cycle {cycle_id} by admin {admin['username']}"
        )
        return cycle

    except Exception as e:
        logger.error(f"Failed to start processing for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/{batch_id}/import", response_model=Dict[str, Any])
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

        logger.info(f"LLM results imported for batch {batch_id} by admin {admin['username']}")
        return result

    except Exception as e:
        logger.error(f"Failed to import LLM results for batch {batch_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/select", response_model=Dict[str, Any])
async def perform_selection(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 6 → Phase 7a: Perform Top-K shortlisting based on final scores."""
    try:
        phase_mgr = PhaseManager(db)
        result = phase_mgr.perform_selection(cycle_id, admin["admin_id"])

        logger.info(f"Shortlisting performed for cycle {cycle_id} by admin {admin['username']}")
        return result

    except Exception as e:
        logger.error(f"Failed to perform selection for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/final-select", response_model=Dict[str, Any])
async def perform_final_selection(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 7b: Perform final selection based on interview scores."""
    try:
        phase_mgr = PhaseManager(db)
        result = phase_mgr.perform_final_selection(cycle_id, admin["admin_id"])

        logger.info(f"Final selection performed for cycle {cycle_id} by admin {admin['username']}")
        return result

    except Exception as e:
        logger.error(f"Failed to perform final selection for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/publish", response_model=AdmissionCycle)
async def publish_results(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 7 → Phase 8: Publish results to student portal."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.publish_results(cycle_id)

        logger.info(f"Results published for cycle {cycle_id} by admin {admin['username']}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to publish results for cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cycles/{cycle_id}/complete", response_model=AdmissionCycle)
async def complete_cycle(
    cycle_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Phase 8 → Phase 9: Complete admission cycle."""
    try:
        phase_mgr = PhaseManager(db)
        cycle = phase_mgr.complete_cycle(cycle_id, admin["username"])

        logger.info(f"Cycle {cycle_id} completed by admin {admin['username']}")
        return cycle

    except Exception as e:
        logger.error(f"Failed to complete cycle {cycle_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/batch/{batch_id}/status", response_model=Dict[str, Any])
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
