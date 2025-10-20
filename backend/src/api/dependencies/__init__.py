"""API dependencies module."""

from .auth import get_current_admin, get_student_session, get_student_auth_service

__all__ = ["get_current_admin", "get_student_session", "get_student_auth_service"]
