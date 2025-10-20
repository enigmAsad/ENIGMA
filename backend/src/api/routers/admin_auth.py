"""Admin authentication routes."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from src.database.engine import get_db
from src.services.admin_auth import AdminAuthService
from src.api.dependencies.auth import get_current_admin
from src.models.schemas import AdminLoginRequest, AdminLoginResponse
from src.utils.logger import get_logger

logger = get_logger("api.admin_auth")

router = APIRouter(prefix="/admin/auth", tags=["Admin Authentication"])


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    try:
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


@router.post("/logout")
async def admin_logout(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Admin logout endpoint."""
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me")
async def get_current_admin_info(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Get current admin user info."""
    return {
        "admin_id": admin["admin_id"],
        "username": admin["username"],
        "email": admin["email"],
        "role": admin["role"]
    }
