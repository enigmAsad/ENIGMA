"""Student (non-auth) routes - interviews, applications, etc."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List

from src.database.engine import get_db
from src.database.repositories import InterviewRepository
from src.api.dependencies.auth import get_student_session
from src.models.schemas import InterviewDetails
from src.utils.logger import get_logger

logger = get_logger("api.student")

router = APIRouter(prefix="/student", tags=["Student"])


@router.get("/interviews/me", response_model=List[InterviewDetails])
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
