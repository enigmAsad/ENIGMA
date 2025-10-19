"""Interview scheduling and management routes."""

from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from src.database.engine import get_db
from src.database.repositories import InterviewRepository, InterviewScoreRepository, ApplicationRepository, AdminRepository
from src.database.models import AdmissionPhaseEnum
from src.api.dependencies.auth import get_current_admin
from src.models.schemas import (
    InterviewCreate,
    InterviewUpdate,
    InterviewDetails,
    InterviewScoreCreate,
    InterviewScoreRead,
)
from src.utils.logger import get_logger

logger = get_logger("api.interviews")

router = APIRouter(prefix="/admin/interviews", tags=["Interviews"])


@router.post("/schedule", response_model=InterviewDetails)
async def schedule_interview(
    request: InterviewCreate,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Schedule a new interview for a selected applicant."""
    try:
        interview_repo = InterviewRepository(db)
        app_repo = ApplicationRepository(db)
        admin_repo = AdminRepository(db)

        # 1. Validate application exists
        application = app_repo.get_by_application_id(request.application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # 2. Get the admission cycle
        cycle = admin_repo.get_cycle_by_id(application.admission_cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Admission cycle not found for this application")

        # 3. Check if cycle is in the correct phase
        if cycle.phase != AdmissionPhaseEnum.SELECTION:
            raise HTTPException(
                status_code=400,
                detail=f"Interviews can only be scheduled when the cycle is in the SELECTION phase, but it is in '{cycle.phase.value}'",
            )

        if not application.student_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot schedule interview for an application with no linked student account."
            )

        # 1. Create interview with a placeholder link
        temp_link = "/interview/pending"
        interview = interview_repo.create_interview(
            application_id=request.application_id,
            student_id=application.student_id,
            admin_id=admin["admin_id"],
            admission_cycle_id=application.admission_cycle_id,
            interview_time=request.interview_time,
            interview_link=temp_link,  # Temporary link
        )
        db.flush()  # Flush to get the ID

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


@router.get("/cycle/{cycle_id}", response_model=List[InterviewDetails])
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


@router.put("/{interview_id}", response_model=InterviewDetails)
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


@router.delete("/{interview_id}", status_code=204)
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


@router.post("/{interview_id}/scores", response_model=InterviewScoreRead)
async def add_interview_score(
    interview_id: int,
    score_data: InterviewScoreCreate,
    admin: Dict[str, Any] = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Add a score to a completed interview."""
    try:
        # Use a single repository instance
        score_repo = InterviewScoreRepository(db)

        # Create the score
        new_score = score_repo.create_score(
            interview_id=interview_id,
            scored_by=admin["admin_id"],
            score_data=score_data,
        )

        # The repository's create_score method already flushes,
        # so the new_score object has an ID. We need to commit to save.
        db.commit()
        db.refresh(new_score)

        logger.info(
            f"Score added to interview {interview_id} by admin {admin['username']}"
        )

        # The 'new_score' object is an ORM model. Pydantic will convert it
        # to the 'InterviewScoreRead' response model automatically.
        return new_score

    except Exception as e:
        db.rollback()
        logger.error(
            f"Failed to add score to interview {interview_id}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
