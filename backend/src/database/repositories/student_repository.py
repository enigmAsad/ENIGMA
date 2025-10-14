"""Repositories for student authentication and OAuth data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session

from src.database.models import (
    StudentAccount,
    OAuthIdentity,
    StudentSession,
    StudentAuthState,
    StudentStatusEnum,
)
from src.database.repositories.base_repository import BaseRepository


class StudentRepository(BaseRepository[StudentAccount]):
    """Repository for student accounts."""

    def __init__(self, db: Session):
        super().__init__(StudentAccount, db)

    def create_student(
        self,
        student_id: str,
        primary_email: str,
        display_name: Optional[str] = None,
        verified_at: Optional[datetime] = None,
    ) -> StudentAccount:
        student = StudentAccount(
            student_id=student_id,
            primary_email=primary_email,
            display_name=display_name,
            verified_at=verified_at,
            status=StudentStatusEnum.ACTIVE,
        )
        self.db.add(student)
        self.db.flush()
        self.db.refresh(student)
        return student

    def get_by_email(self, email: str) -> Optional[StudentAccount]:
        stmt = select(StudentAccount).where(StudentAccount.primary_email == email)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def set_status(self, student_id: str, status: StudentStatusEnum) -> Optional[StudentAccount]:
        stmt = (
            update(StudentAccount)
            .where(StudentAccount.student_id == student_id)
            .values(status=status, updated_at=datetime.now(timezone.utc))
            .returning(StudentAccount)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()


class OAuthIdentityRepository(BaseRepository[OAuthIdentity]):
    """Repository for linked OAuth identities."""

    def __init__(self, db: Session):
        super().__init__(OAuthIdentity, db)

    def find_by_provider_sub(self, provider: str, provider_sub: str) -> Optional[OAuthIdentity]:
        stmt = select(OAuthIdentity).where(
            OAuthIdentity.provider == provider,
            OAuthIdentity.provider_sub == provider_sub,
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def list_for_student(self, student_id: str) -> Sequence[OAuthIdentity]:
        stmt = select(OAuthIdentity).where(OAuthIdentity.student_id == student_id)
        result = self.db.execute(stmt)
        return result.scalars().all()


class StudentSessionRepository(BaseRepository[StudentSession]):
    """Repository for student sessions."""

    def __init__(self, db: Session):
        super().__init__(StudentSession, db)

    def create_session(
        self,
        session_id: str,
        student_id: str,
        session_token_hash: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> StudentSession:
        session = StudentSession(
            session_id=session_id,
            student_id=student_id,
            session_token_hash=session_token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(session)
        self.db.flush()
        self.db.refresh(session)
        return session

    def find_by_token_hash(self, token_hash: str) -> Optional[StudentSession]:
        stmt = select(StudentSession).where(StudentSession.session_token_hash == token_hash)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def mark_revoked(self, session_id: str) -> bool:
        stmt = (
            update(StudentSession)
            .where(StudentSession.session_id == session_id)
            .values(revoked=True)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount > 0

    def cleanup_expired_sessions(self) -> int:
        stmt = delete(StudentSession).where(StudentSession.expires_at < datetime.now(timezone.utc))
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount


class StudentAuthStateRepository(BaseRepository[StudentAuthState]):
    """Repository for transient OAuth state records."""

    def __init__(self, db: Session):
        super().__init__(StudentAuthState, db)

    def create_state(
        self,
        state: str,
        code_challenge: str,
        redirect_uri: str,
        nonce: Optional[str],
        expires_at: datetime,
    ) -> StudentAuthState:
        record = StudentAuthState(
            state=state,
            code_challenge=code_challenge,
            code_verifier_hash="",  # This will be set during the callback
            redirect_uri=redirect_uri,
            nonce=nonce,
            expires_at=expires_at,
        )
        self.db.add(record)
        self.db.flush()
        self.db.refresh(record)
        return record

    def consume_state(self, state: str) -> Optional[StudentAuthState]:
        stmt = (
            update(StudentAuthState)
            .where(
                StudentAuthState.state == state,
                StudentAuthState.consumed == False,
                StudentAuthState.expires_at >= datetime.now(timezone.utc),
            )
            .values(consumed=True)
            .returning(StudentAuthState)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def cleanup_expired_states(self) -> int:
        stmt = delete(StudentAuthState).where(
            StudentAuthState.expires_at < datetime.now(timezone.utc)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

