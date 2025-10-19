"""Repository pattern implementations for database access."""

from src.database.repositories.application_repository import ApplicationRepository
from src.database.repositories.admin_repository import AdminRepository
from src.database.repositories.batch_repository import BatchRepository
from src.database.repositories.audit_repository import AuditRepository
from src.database.repositories.student_repository import (
    StudentRepository,
    OAuthIdentityRepository,
    StudentSessionRepository,
    StudentAuthStateRepository,
)
from src.database.repositories.interview_repository import InterviewRepository
from src.database.repositories.interview_score_repository import InterviewScoreRepository

__all__ = [
    "ApplicationRepository",
    "AdminRepository",
    "BatchRepository",
    "AuditRepository",
    "StudentRepository",
    "OAuthIdentityRepository",
    "StudentSessionRepository",
    "StudentAuthStateRepository",
    "InterviewRepository",
    "InterviewScoreRepository",
]
