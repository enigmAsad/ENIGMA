"""FastAPI REST API wrapper for ENIGMA Phase 1 backend - Modular Architecture.

This is the main entry point for the ENIGMA API. All routes are organized into
domain-specific routers in src/api/routers/ for better maintainability.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from src.api.routers import (
    public,
    applications,
    student_auth,
    student,
    admin_auth,
    admin_cycles,
    admin_phases,
    interviews,
    bias_monitoring,
    websockets,
)

# Initialize FastAPI app
app = FastAPI(
    title="ENIGMA Phase 1 API",
    description="AI-powered blind merit screening system with modular architecture",
    version="2.4.0"
)

# CORS middleware configuration

origins = [
    # DEVELOPMENT ORIGINS
    "http://localhost",
    "http://localhost:3000",  # Local Frontend
    "http://localhost:8080",
    "http://127.0.0.1:8000",

    # DEPLOYMENT ORIGINS (The frontend is running on port 3000)
    "http://enigma-app.ddns.net",
    "http://enigma-app.ddns.net:3000",  # <--- This is the essential fix!
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# Router Registration
# ==============================================================================

# Public routes (no prefix, no authentication required)
app.include_router(public.router)

# Application routes (public submission, status checking)
app.include_router(applications.router)

# Student authentication and profile routes
app.include_router(student_auth.router)

# Student routes (non-auth: interviews, etc.)
app.include_router(student.router)

# Admin authentication routes
app.include_router(admin_auth.router)

# Admin cycle management routes
app.include_router(admin_cycles.router)

# Admin phase management routes (9-phase workflow)
app.include_router(admin_phases.router)

# Interview scheduling and management routes
app.include_router(interviews.router)

# Bias monitoring dashboard routes (Phase 2)
app.include_router(bias_monitoring.router)

# WebSocket routes (audio, nudges, WebRTC signaling)
app.include_router(websockets.router)


# ==============================================================================
# Main Entry Point
# ==============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
