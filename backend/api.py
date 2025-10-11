"""FastAPI REST API wrapper for ENIGMA Phase 1 backend."""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
import logging

from src.config.settings import get_settings
from src.models.schemas import Application, ApplicationStatus
from src.services.application_collector import ApplicationCollector
from src.services.hash_chain import HashChainGenerator
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger, AuditLogger
from src.orchestration.phase1_pipeline import run_pipeline

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
async def health_check():
    """Health check endpoint."""
    try:
        settings = get_settings()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "data_dir": str(settings.data_dir),
            "api_configured": bool(settings.openai_api_key)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.post("/applications", response_model=ApplicationSubmitResponse)
async def submit_application(
    request: ApplicationSubmitRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit a new application for Phase 1 evaluation.
    Processing happens asynchronously in the background.
    """
    try:
        # Initialize services
        csv_handler = CSVHandler()
        audit_logger = AuditLogger(csv_handler=csv_handler)
        app_collector = ApplicationCollector(
            csv_handler=csv_handler,
            audit_logger=audit_logger
        )

        # Create application object
        app_data = request.model_dump()
        application = app_collector.collect_application(app_data)

        # Queue for background processing
        background_tasks.add_task(process_application_background, application)

        logger.info(f"Application submitted: {application.application_id}")

        return ApplicationSubmitResponse(
            success=True,
            application_id=application.application_id,
            message="Application submitted successfully. Processing in background.",
            status=ApplicationStatus.SUBMITTED.value,
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Application submission failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/applications/{application_id}", response_model=ApplicationStatusResponse)
async def get_application_status(application_id: str):
    """Get the current status of an application."""
    try:
        csv_handler = CSVHandler()

        # Get application
        application = csv_handler.get_application_by_id(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Check for anonymized ID
        anonymized_id = None
        try:
            anonymized = csv_handler.get_anonymized_by_application_id(application_id)
            if anonymized:
                anonymized_id = anonymized.get("anonymized_id")
        except:
            pass

        # Determine status message
        status = application.status.value
        if status == ApplicationStatus.COMPLETED.value:
            message = "Evaluation complete. Results available."
        elif status == ApplicationStatus.FAILED.value:
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
async def get_results(anonymized_id: str):
    """Get final evaluation results by anonymized ID."""
    try:
        csv_handler = CSVHandler()

        # Get final score
        final_score = csv_handler.get_final_score(anonymized_id)
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
async def verify_hash(request: VerifyRequest):
    """Verify the integrity of a decision hash."""
    try:
        csv_handler = CSVHandler()
        hash_chain = HashChainGenerator(csv_handler=csv_handler)

        # Get stored hash for this anonymized_id
        final_score = csv_handler.get_final_score(request.anonymized_id)
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
async def verify_entire_chain():
    """Verify the integrity of the entire hash chain."""
    try:
        csv_handler = CSVHandler()
        hash_chain = HashChainGenerator(csv_handler=csv_handler)

        result = hash_chain.verify_chain()

        return {
            "is_valid": result["is_valid"],
            "chain_length": result["chain_length"],
            "first_entry": result.get("first_entry_timestamp"),
            "last_entry": result.get("last_entry_timestamp"),
            "invalid_entries": result.get("invalid_entries", []),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Chain verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats():
    """Get aggregate statistics for public dashboard."""
    try:
        csv_handler = CSVHandler()

        # Get counts
        all_apps = csv_handler._read_csv(csv_handler.APPLICATIONS_CSV)
        final_scores_data = csv_handler._read_csv(csv_handler.FINAL_SCORES_CSV)

        total_applications = len(all_apps)
        completed_evaluations = len(final_scores_data)

        # Calculate average score
        average_score = None
        if final_scores_data:
            scores = [float(s["final_score"]) for s in final_scores_data]
            average_score = sum(scores) / len(scores)

        # Score distribution (by ranges)
        score_distribution = {
            "90-100": 0,
            "80-89": 0,
            "70-79": 0,
            "60-69": 0,
            "below-60": 0
        }

        for score_data in final_scores_data:
            score = float(score_data["final_score"])
            if score >= 90:
                score_distribution["90-100"] += 1
            elif score >= 80:
                score_distribution["80-89"] += 1
            elif score >= 70:
                score_distribution["70-79"] += 1
            elif score >= 60:
                score_distribution["60-69"] += 1
            else:
                score_distribution["below-60"] += 1

        # Processing stats by status
        processing_stats = {}
        for app in all_apps:
            status = app.get("status", "unknown")
            processing_stats[status] = processing_stats.get(status, 0) + 1

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
