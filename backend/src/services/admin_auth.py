"""Admin authentication service for ENIGMA."""

import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, Tuple

from src.config.settings import get_settings
from src.models.schemas import AdminUser, AdminSession
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger

logger = get_logger("admin_auth")


class AdminAuthService:
    """Admin authentication and session management."""

    def __init__(self, csv_handler: Optional[CSVHandler] = None):
        """Initialize admin auth service.

        Args:
            csv_handler: CSV handler instance (optional, will create if not provided)
        """
        self.csv_handler = csv_handler or CSVHandler()
        self.settings = get_settings()

        # JWT secret from settings (fallback to a default for development)
        self.jwt_secret = getattr(
            self.settings,
            'jwt_secret',
            'your-secret-key-change-in-production-please'
        )
        self.token_expiry_hours = getattr(self.settings, 'admin_token_expiry_hours', 24)

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt.

        Args:
            password: Plain text password

        Returns:
            str: Hashed password
        """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify a password against its hash.

        Args:
            password: Plain text password
            password_hash: Hashed password

        Returns:
            bool: True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'),
                password_hash.encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    def create_token(self, admin_id: str, username: str) -> Tuple[str, datetime]:
        """Create a JWT token for admin user.

        Args:
            admin_id: Admin user ID
            username: Admin username

        Returns:
            Tuple[str, datetime]: (JWT token, expiration datetime)
        """
        expires_at = datetime.utcnow() + timedelta(hours=self.token_expiry_hours)

        payload = {
            'admin_id': admin_id,
            'username': username,
            'exp': expires_at,
            'iat': datetime.utcnow()
        }

        token = jwt.encode(payload, self.jwt_secret, algorithm='HS256')
        return token, expires_at

    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode a JWT token.

        Args:
            token: JWT token

        Returns:
            Optional[dict]: Decoded payload if valid, None otherwise
        """
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    def login(
        self,
        username: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Tuple[AdminUser, str, datetime]]:
        """Authenticate admin user and create session.

        Args:
            username: Admin username
            password: Plain text password
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)

        Returns:
            Optional[Tuple[AdminUser, str, datetime]]:
                (admin user, token, expires_at) if successful, None otherwise
        """
        # Get admin user
        admin = self.csv_handler.get_admin_by_username(username)
        if not admin:
            logger.warning(f"Login failed: User '{username}' not found")
            return None

        # Check if account is active
        if not admin.is_active:
            logger.warning(f"Login failed: User '{username}' is inactive")
            return None

        # Verify password
        if not self.verify_password(password, admin.password_hash):
            logger.warning(f"Login failed: Invalid password for '{username}'")
            return None

        # Create token
        token, expires_at = self.create_token(admin.admin_id, admin.username)

        # Create session record
        session = AdminSession(
            admin_id=admin.admin_id,
            token=token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.csv_handler.append_admin_session(session)

        # Update last login
        admin.last_login = datetime.utcnow()
        self.csv_handler.update_admin_user(admin)

        logger.info(f"Admin login successful: {username}")
        return admin, token, expires_at

    def get_current_admin(self, token: str) -> Optional[AdminUser]:
        """Get current admin user from token.

        Args:
            token: JWT token

        Returns:
            Optional[AdminUser]: Admin user if token valid, None otherwise
        """
        payload = self.verify_token(token)
        if not payload:
            return None

        admin_id = payload.get('admin_id')
        if not admin_id:
            return None

        admin = self.csv_handler.get_admin_by_id(admin_id)
        if not admin or not admin.is_active:
            return None

        return admin

    def create_admin_user(
        self,
        username: str,
        password: str,
        email: str,
        role: str = "admin"
    ) -> AdminUser:
        """Create a new admin user.

        Args:
            username: Admin username
            password: Plain text password
            email: Admin email
            role: Admin role (default: "admin")

        Returns:
            AdminUser: Created admin user

        Raises:
            ValueError: If username already exists
        """
        # Check if username exists
        existing = self.csv_handler.get_admin_by_username(username)
        if existing:
            raise ValueError(f"Username '{username}' already exists")

        # Hash password
        password_hash = self.hash_password(password)

        # Create admin user
        admin = AdminUser(
            username=username,
            password_hash=password_hash,
            email=email,
            role=role
        )

        self.csv_handler.append_admin_user(admin)
        logger.info(f"Created admin user: {username}")

        return admin

    def logout(self, token: str):
        """Logout admin user (invalidate session).

        Note: Currently, we don't actively invalidate tokens in CSV.
        Tokens expire naturally based on JWT exp claim.
        For full invalidation, consider adding a blacklist CSV or token revocation.

        Args:
            token: JWT token
        """
        # For now, just log the logout
        # In a full implementation, you could add token to a blacklist CSV
        payload = self.verify_token(token)
        if payload:
            logger.info(f"Admin logout: {payload.get('username')}")
