"""Student authentication service integrating Google OAuth (OIDC + PKCE)."""

from __future__ import annotations

import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.config.settings import get_settings
from src.database.repositories import (
    StudentRepository,
    OAuthIdentityRepository,
    StudentSessionRepository,
    StudentAuthStateRepository,
    ApplicationRepository,  # Import ApplicationRepository
    AdminRepository,        # Import AdminRepository
)
from src.database.models import StudentStatusEnum, Application, FinalScore
from src.utils.logger import get_logger


logger = get_logger("student_auth")


class StudentAuthService:
    """Service handling student Google OAuth login and session management."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.students = StudentRepository(db)
        self.identities = OAuthIdentityRepository(db)
        self.sessions = StudentSessionRepository(db)
        self.auth_states = StudentAuthStateRepository(db)
        self.applications = ApplicationRepository(db) # Add application repo
        self.admins = AdminRepository(db) # Add admin repo

    # ------------------------------------------------------------------
    # PKCE / OIDC helpers
    # ------------------------------------------------------------------

    def _hash_code_verifier(self, code_verifier: str) -> str:
        """Hashes the code verifier using SHA-256 and base64url encodes it for PKCE."""
        digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('utf-8')

    def _hash_session_token(self, session_token: str) -> str:
        return hashlib.sha256(session_token.encode("ascii")).hexdigest()

    def _generate_nonce(self) -> str:
        return secrets.token_urlsafe(16)

    def _generate_state(self) -> str:
        return secrets.token_urlsafe(16)

    # ------------------------------------------------------------------
    # OAuth URLs / metadata
    # ------------------------------------------------------------------

    @property
    def google_authorize_url(self) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth"

    @property
    def google_token_url(self) -> str:
        return "https://oauth2.googleapis.com/token"

    @property
    def google_userinfo_url(self) -> str:
        return "https://openidconnect.googleapis.com/v1/userinfo"

    # ------------------------------------------------------------------
    # State Management
    # ------------------------------------------------------------------

    def create_auth_state(
        self,
        code_challenge: str,
        redirect_uri: str,
    ) -> Dict[str, str]:
        state = self._generate_state()
        nonce = self._generate_nonce()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # The code_verifier is not stored, only its hash is used in the callback.
        # Here, we store the challenge to associate it with the state.
        self.auth_states.create_state(
            state=state,
            code_challenge=code_challenge,
            redirect_uri=redirect_uri,
            nonce=nonce,
            expires_at=expires_at,
        )

        logger.debug(f"Created OAuth state {state} expiring at {expires_at}")
        return {"state": state, "nonce": nonce}

    def validate_auth_state(self, state: str) -> Optional[Any]:
        record = self.auth_states.consume_state(state)
        if not record:
            logger.warning("Invalid or expired OAuth state")
            return None

        # Commit immediately to release the lock on the auth_states table
        self.db.commit()

        return record

    # ------------------------------------------------------------------
    # Student sessions
    # ------------------------------------------------------------------

    def _issue_session(
        self,
        student_id: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> Dict[str, Any]:
        session_id = f"STS_{uuid.uuid4().hex[:10].upper()}"
        session_token = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=self.settings.student_session_ttl_hours)

        session = self.sessions.create_session(
            session_id=session_id,
            student_id=student_id,
            session_token_hash=self._hash_session_token(session_token),
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info(f"Issued session {session.session_id} for student {student_id}")

        return {
            "session_id": session.session_id,
            "session_token": session_token,
            "student_id": student_id,
            "expires_at": expires_at,
        }

    def revoke_session(self, session_token: str) -> bool:
        token_hash = self._hash_session_token(session_token)
        session = self.sessions.find_by_token_hash(token_hash)
        if not session:
            return False
        revoked = self.sessions.mark_revoked(session.session_id)
        logger.info(f"Revoked session {session.session_id}")
        return revoked

    # ------------------------------------------------------------------
    # Google OAuth exchange
    # ------------------------------------------------------------------

    async def exchange_code_for_tokens(
        self,
        code: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> Dict[str, Any]:
        payload = {
            "client_id": self.settings.google_client_id,
            "client_secret": self.settings.google_client_secret,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self.google_token_url, data=payload)
            if response.status_code != 200:
                logger.error(
                    "Failed to exchange Google authorization code", extra={"status": response.status_code, "body": response.text}
                )
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
            tokens = response.json()

        return tokens

    async def fetch_userinfo(self, access_token: str, id_token: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.google_userinfo_url, headers=headers)
            if response.status_code != 200:
                logger.error("Failed to fetch Google user info", extra={"status": response.status_code})
                raise HTTPException(status_code=400, detail="Failed to fetch user profile")
            userinfo = response.json()

        # Basic validation of id_token nonce is recommended but requires JWT decoding with Google's certs.
        # For MVP, rely on email_verified flag and HTTPS token exchange.
        return userinfo

    # ------------------------------------------------------------------
    # Student account orchestration
    # ------------------------------------------------------------------

    def _ensure_student_account(
        self,
        email: str,
        name: Optional[str],
        email_verified: bool,
    ) -> Any:
        existing_student = self.students.get_by_email(email)
        if existing_student:
            if existing_student.status != StudentStatusEnum.ACTIVE:
                raise HTTPException(status_code=403, detail="Student account is not active")
            return existing_student

        if not email_verified:
            raise HTTPException(status_code=400, detail="Google account email is not verified")

        student_id = f"STU_{uuid.uuid4().hex[:8].upper()}"
        student = self.students.create_student(
            student_id=student_id,
            primary_email=email,
            display_name=name,
            verified_at=datetime.now(timezone.utc),
        )
        logger.info(f"Created new student account {student.student_id} for {email}")
        return student

    def _link_oauth_identity(
        self,
        student_id: str,
        provider: str,
        provider_sub: str,
        email: str,
        email_verified: bool,
        raw_profile: Dict[str, Any],
    ) -> None:
        identity = self.identities.find_by_provider_sub(provider, provider_sub)
        if identity:
            if identity.student_id != student_id:
                logger.warning("OAuth identity already linked to another student")
                raise HTTPException(status_code=409, detail="OAuth identity already linked")
            # Update email verification status if necessary
            if identity.email_verified != email_verified or identity.email != email:
                self.identities.update(
                    identity.identity_id,
                    {
                        "email": email,
                        "email_verified": email_verified,
                        "raw_profile": raw_profile,
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "identity_id",
                )
            return

        self.identities.create(
            {
                "student_id": student_id,
                "provider": provider,
                "provider_sub": provider_sub,
                "email": email,
                "email_verified": email_verified,
                "raw_profile": raw_profile,
            }
        )
        logger.info(f"Linked OAuth identity {provider}:{provider_sub} to student {student_id}")

    # ------------------------------------------------------------------
    # Public flows
    # ------------------------------------------------------------------

    async def complete_google_login(
        self,
        *,
        code: str,
        state: str,
        code_verifier: str,
        redirect_uri: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> Dict[str, Any]:
        state_record = self.validate_auth_state(state)
        if not state_record:
            raise HTTPException(status_code=400, detail="Invalid or expired state")

        # Verify the PKCE code challenge
        computed_challenge = self._hash_code_verifier(code_verifier)
        if state_record.code_challenge != computed_challenge:
            logger.warning("PKCE code_challenge mismatch for state %s", state)
            raise HTTPException(status_code=400, detail="Invalid code verifier")

        tokens = await self.exchange_code_for_tokens(code, code_verifier, redirect_uri)
        userinfo = await self.fetch_userinfo(tokens["access_token"], tokens.get("id_token", ""))

        email = userinfo.get("email")
        email_verified = userinfo.get("email_verified", False)
        sub = userinfo.get("sub")
        name = userinfo.get("name")

        if not email or not sub:
            raise HTTPException(status_code=400, detail="Google profile missing required fields")

        student = self._ensure_student_account(email=email, name=name, email_verified=email_verified)
        self._link_oauth_identity(
            student_id=student.student_id,
            provider="google",
            provider_sub=sub,
            email=email,
            email_verified=email_verified,
            raw_profile=userinfo,
        )

        session = self._issue_session(student.student_id, ip_address, user_agent)
        self.db.commit()

        logger.info(f"Student {student.student_id} logged in via Google")
        return {
            "student_id": student.student_id,
            "primary_email": student.primary_email,
            "display_name": student.display_name,
            "session_token": session["session_token"],
            "session_expires_at": session["expires_at"],
            "session_id": session["session_id"],
        }

    def validate_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        token_hash = self._hash_session_token(session_token)
        session = self.sessions.find_by_token_hash(token_hash)
        if not session or session.revoked:
            return None

        if session.expires_at < datetime.now(timezone.utc):
            return None

        student = self.students.get_by_id(session.student_id, "student_id")
        if not student or student.status != StudentStatusEnum.ACTIVE:
            return None

        # --- Fetch Application Data ---
        application_data = None
        # Only fetch application for the ACTIVE cycle to avoid showing stale data
        active_cycle = self.admins.get_active_cycle()

        if active_cycle:
            # Find the application for this student in the active cycle
            application = self.db.query(Application).filter(
                Application.student_id == student.student_id,
                Application.admission_cycle_id == active_cycle.cycle_id
            ).order_by(Application.created_at.desc()).first()

            if application:
                results = self.db.query(FinalScore).filter(
                    FinalScore.anonymized_id == application.anonymized.anonymized_id
                ).first() if application.anonymized else None

                application_data = {
                    "status": {
                        "application_id": application.application_id,
                        "anonymized_id": application.anonymized.anonymized_id if application.anonymized else None,
                        "status": application.status.value,
                        "message": "Status retrieved",
                        "timestamp": application.updated_at or application.timestamp,
                    },
                    "results": results
                }
        # --------------------------------

        # Update last_active timestamp for rolling activity
        self.sessions.update(
            session.session_id,
            {"last_active_at": datetime.now(timezone.utc)},
            "session_id",
        )

        return {
            "student_id": student.student_id,
            "primary_email": student.primary_email,
            "display_name": student.display_name,
            "status": student.status.value,
            "application": application_data,  # Include application data
        }

    def cleanup(self) -> Dict[str, int]:
        sessions_removed = self.sessions.cleanup_expired_sessions()
        states_removed = self.auth_states.cleanup_expired_states()
        if sessions_removed or states_removed:
            self.db.commit()
        return {"sessions_removed": sessions_removed, "states_removed": states_removed}

