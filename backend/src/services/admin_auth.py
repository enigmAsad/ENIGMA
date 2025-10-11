"""Admin authentication service using PostgreSQL and JWT."""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta

import bcrypt
import jwt
from sqlalchemy.orm import Session

from src.database.repositories import AdminRepository, AuditRepository
from src.database.models import AdminRoleEnum, AuditActionEnum
from src.config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("admin_auth")


class AdminAuthService:
    """PostgreSQL-based service for admin authentication and session management."""

    def __init__(self, db: Session):
        """Initialize admin auth service.

        Args:
            db: Database session
        """
        self.db = db
        self.admin_repo = AdminRepository(db)
        self.audit_repo = AuditRepository(db)
        self.settings = get_settings()

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt.

        Args:
            password: Plain text password

        Returns:
            str: Bcrypt hashed password
        """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify a password against its hash.

        Args:
            password: Plain text password
            password_hash: Bcrypt hash

        Returns:
            bool: True if password matches
        """
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'),
                password_hash.encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    def generate_jwt_token(
        self,
        admin_id: str,
        username: str,
        role: AdminRoleEnum
    ) -> tuple[str, datetime]:
        """Generate JWT token for admin user.

        Args:
            admin_id: Admin user ID
            username: Admin username
            role: Admin role

        Returns:
            tuple[str, datetime]: (JWT token, expiration datetime)
        """
        expiry_hours = self.settings.admin_token_expiry_hours
        expires_at = datetime.utcnow() + timedelta(hours=expiry_hours)

        payload = {
            "admin_id": admin_id,
            "username": username,
            "role": role.value,
            "exp": expires_at,
            "iat": datetime.utcnow(),
            "type": "admin_access"
        }

        token = jwt.encode(
            payload,
            self.settings.jwt_secret,
            algorithm="HS256"
        )

        return token, expires_at

    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token.

        Args:
            token: JWT token string

        Returns:
            Optional[Dict]: Decoded payload or None if invalid
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=["HS256"]
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            return None

    def login(
        self,
        username: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Authenticate admin user and create session.

        Args:
            username: Admin username
            password: Plain text password
            ip_address: Optional client IP
            user_agent: Optional user agent string

        Returns:
            Optional[Dict]: Login result with token or None if failed
        """
        logger.info(f"Login attempt for username: {username}")

        # Get admin user
        admin = self.admin_repo.get_by_username(username)
        if not admin:
            logger.warning(f"Login failed: user {username} not found")
            return None

        # Check if active
        if not admin.is_active:
            logger.warning(f"Login failed: user {username} is inactive")
            return None

        # Verify password
        if not self.verify_password(password, admin.password_hash):
            logger.warning(f"Login failed: invalid password for {username}")
            # Audit failed login attempt
            self.audit_repo.create_audit_log(
                entity_type="AdminUser",
                entity_id=admin.admin_id,
                action=AuditActionEnum.LOGIN,
                actor=username,
                details={"success": False, "reason": "invalid_password"}
            )
            self.db.commit()
            return None

        # Generate JWT token
        token, expires_at = self.generate_jwt_token(
            admin.admin_id,
            admin.username,
            admin.role
        )

        # Create session
        import uuid
        session_id = f"SES_{uuid.uuid4().hex[:8].upper()}"

        session = self.admin_repo.create_session(
            session_id=session_id,
            admin_id=admin.admin_id,
            token=token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )

        # Update last login
        self.admin_repo.update_last_login(admin.admin_id)

        # Audit successful login
        self.audit_repo.create_audit_log(
            entity_type="AdminUser",
            entity_id=admin.admin_id,
            action=AuditActionEnum.LOGIN,
            actor=username,
            details={
                "success": True,
                "session_id": session_id,
                "ip_address": ip_address
            }
        )

        self.db.commit()

        logger.info(f"Login successful for {username}")

        return {
            "success": True,
            "token": token,
            "admin_id": admin.admin_id,
            "username": admin.username,
            "email": admin.email,
            "role": admin.role.value,
            "expires_at": expires_at.isoformat()
        }

    def logout(self, token: str) -> bool:
        """Logout admin user by revoking session.

        Args:
            token: JWT token

        Returns:
            bool: True if logout successful
        """
        logger.info("Logout attempt")

        # Verify token first
        payload = self.verify_jwt_token(token)
        if not payload:
            return False

        # Revoke session
        revoked = self.admin_repo.revoke_session(token)

        if revoked:
            # Audit logout
            self.audit_repo.create_audit_log(
                entity_type="AdminUser",
                entity_id=payload.get("admin_id"),
                action=AuditActionEnum.LOGOUT,
                actor=payload.get("username"),
                details={"success": True}
            )
            self.db.commit()
            logger.info(f"Logout successful for {payload.get('username')}")

        return revoked

    def validate_session(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate admin session.

        Args:
            token: JWT token

        Returns:
            Optional[Dict]: Admin info if session valid, None otherwise
        """
        # Verify JWT token
        payload = self.verify_jwt_token(token)
        if not payload:
            return None

        # Check if session is revoked
        if not self.admin_repo.is_session_valid(token):
            return None

        # Get admin user
        admin = self.admin_repo.get_by_id(payload.get("admin_id"), "admin_id")
        if not admin or not admin.is_active:
            return None

        return {
            "admin_id": admin.admin_id,
            "username": admin.username,
            "email": admin.email,
            "role": admin.role.value,
            "is_active": admin.is_active
        }

    def get_current_admin(self, token: str) -> Optional[Dict[str, Any]]:
        """Get current admin user from token.

        Args:
            token: JWT token

        Returns:
            Optional[Dict]: Admin user info
        """
        return self.validate_session(token)

    def change_password(
        self,
        admin_id: str,
        old_password: str,
        new_password: str
    ) -> bool:
        """Change admin password.

        Args:
            admin_id: Admin ID
            old_password: Current password
            new_password: New password

        Returns:
            bool: True if password changed successfully
        """
        admin = self.admin_repo.get_by_id(admin_id, "admin_id")
        if not admin:
            return False

        # Verify old password
        if not self.verify_password(old_password, admin.password_hash):
            logger.warning(f"Password change failed for {admin.username}: invalid old password")
            return False

        # Hash new password
        new_password_hash = self.hash_password(new_password)

        # Update admin
        updated = self.admin_repo.update(
            admin_id,
            {"password_hash": new_password_hash},
            "admin_id"
        )

        if updated:
            # Revoke all existing sessions for security
            self.admin_repo.revoke_all_user_sessions(admin_id)

            # Audit password change
            self.audit_repo.create_audit_log(
                entity_type="AdminUser",
                entity_id=admin_id,
                action=AuditActionEnum.UPDATE,
                actor=admin.username,
                details={"action": "password_change"}
            )

            self.db.commit()
            logger.info(f"Password changed for {admin.username}")

        return updated is not None

    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions.

        Returns:
            int: Number of sessions removed
        """
        count = self.admin_repo.cleanup_expired_sessions()
        if count > 0:
            self.db.commit()
            logger.info(f"Cleaned up {count} expired sessions")
        return count


# FastAPI dependency for protecting routes
def get_current_admin_dependency(db: Session):
    """FastAPI dependency to get current admin from request header.

    Usage:
        @app.get("/admin/endpoint")
        def protected_route(admin: dict = Depends(get_current_admin_dependency)):
            # admin contains the validated admin user info
            pass
    """
    from fastapi import Depends, HTTPException, status
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

    security = HTTPBearer()

    def get_current_admin(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(db)
    ):
        token = credentials.credentials
        auth_service = AdminAuthService(db)
        admin = auth_service.validate_session(token)

        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        return admin

    return get_current_admin
