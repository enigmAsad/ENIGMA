"""Authentication dependencies for API routes."""

from fastapi import Header, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from src.database.engine import get_db
from src.services.admin_auth import AdminAuthService
from src.services.student_auth import StudentAuthService


def get_student_auth_service(db: Session = Depends(get_db)) -> StudentAuthService:
    """Factory for StudentAuthService.

    Args:
        db: Database session

    Returns:
        StudentAuthService instance
    """
    return StudentAuthService(db)


def get_student_session(
    session_token: Optional[str] = Cookie(default=None, alias="enigma_student_session"),
    db: Session = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    """Dependency to get current authenticated student session.

    Args:
        session_token: Session token from cookie
        db: Database session

    Returns:
        Optional[Dict[str, Any]]: Student session data if authenticated, None otherwise
            Returns dict with keys: student_id, primary_email, display_name, status, application
    """
    if not session_token:
        return None
    auth_service = StudentAuthService(db)
    return auth_service.validate_session(session_token)


async def get_current_admin(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Dependency to get current authenticated admin.

    Args:
        authorization: Authorization header (Bearer token)
        db: Database session

    Returns:
        Dict[str, Any]: Authenticated admin user info (dict with admin_id, username, email, role, is_active)

    Raises:
        HTTPException: If authentication fails (401)
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace('Bearer ', '')
    auth_service = AdminAuthService(db)
    admin = auth_service.get_current_admin(token)

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return admin
