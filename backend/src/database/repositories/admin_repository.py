"""Admin repository for managing admin users, cycles, and sessions."""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, update, and_

from src.database.models import (
    AdminUser, AdminSession, AdmissionCycle,
    SelectionLog, AdminRoleEnum, AdmissionPhaseEnum
)
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("admin_repository")


class AdminRepository(BaseRepository[AdminUser]):
    """Repository for admin-related operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(AdminUser, db)

    # Admin User Operations

    def create_admin(
        self,
        admin_id: str,
        username: str,
        password_hash: str,
        email: str,
        role: AdminRoleEnum = AdminRoleEnum.ADMIN
    ) -> AdminUser:
        """Create admin user.

        Args:
            admin_id: Unique admin ID
            username: Admin username
            password_hash: Bcrypt password hash
            email: Admin email
            role: Admin role

        Returns:
            AdminUser: Created admin
        """
        admin = AdminUser(
            admin_id=admin_id,
            username=username,
            password_hash=password_hash,
            email=email,
            role=role,
            is_active=True
        )
        return self.create(admin)

    def get_by_username(self, username: str) -> Optional[AdminUser]:
        """Get admin by username."""
        stmt = select(AdminUser).where(AdminUser.username == username)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_email(self, email: str) -> Optional[AdminUser]:
        """Get admin by email."""
        stmt = select(AdminUser).where(AdminUser.email == email)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def update_last_login(self, admin_id: str) -> Optional[AdminUser]:
        """Update admin's last login timestamp."""
        return self.update(
            admin_id,
            {"last_login": datetime.utcnow()},
            "admin_id"
        )

    def deactivate_admin(self, admin_id: str) -> Optional[AdminUser]:
        """Deactivate admin account."""
        return self.update(admin_id, {"is_active": False}, "admin_id")

    # Session Operations

    def create_session(
        self,
        session_id: str,
        admin_id: str,
        token: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AdminSession:
        """Create admin session.

        Args:
            session_id: Unique session ID
            admin_id: Admin user ID
            token: JWT token
            expires_at: Expiration datetime
            ip_address: Optional IP address
            user_agent: Optional user agent string

        Returns:
            AdminSession: Created session
        """
        session = AdminSession(
            session_id=session_id,
            admin_id=admin_id,
            token=token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            revoked=False
        )
        self.db.add(session)
        self.db.flush()
        self.db.refresh(session)
        return session

    def get_session_by_token(self, token: str) -> Optional[AdminSession]:
        """Get session by token."""
        stmt = select(AdminSession).where(AdminSession.token == token)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def is_session_valid(self, token: str) -> bool:
        """Check if session is valid (not revoked and not expired).

        Args:
            token: JWT token

        Returns:
            bool: True if valid, False otherwise
        """
        session = self.get_session_by_token(token)
        if not session:
            return False

        if session.revoked:
            return False

        if session.expires_at < datetime.utcnow():
            return False

        return True

    def revoke_session(self, token: str) -> bool:
        """Revoke a session.

        Args:
            token: JWT token to revoke

        Returns:
            bool: True if revoked, False if not found
        """
        stmt = (
            update(AdminSession)
            .where(AdminSession.token == token)
            .values(revoked=True)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount > 0

    def revoke_all_user_sessions(self, admin_id: str) -> int:
        """Revoke all sessions for a user.

        Args:
            admin_id: Admin user ID

        Returns:
            int: Number of sessions revoked
        """
        stmt = (
            update(AdminSession)
            .where(
                AdminSession.admin_id == admin_id,
                AdminSession.revoked == False
            )
            .values(revoked=True)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions from database.

        Returns:
            int: Number of sessions removed
        """
        from sqlalchemy import delete
        stmt = delete(AdminSession).where(
            AdminSession.expires_at < datetime.utcnow()
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    # Admission Cycle Operations

    def create_cycle(
        self,
        cycle_id: str,
        cycle_name: str,
        max_seats: int,
        result_date: datetime,
        start_date: datetime,
        end_date: datetime,
        created_by: str
    ) -> AdmissionCycle:
        """Create admission cycle.

        Args:
            cycle_id: Unique cycle ID
            cycle_name: Cycle name
            max_seats: Maximum seats
            result_date: Result announcement date
            start_date: Admission window start
            end_date: Admission window end
            created_by: Admin ID who created

        Returns:
            AdmissionCycle: Created cycle
        """
        cycle = AdmissionCycle(
            cycle_id=cycle_id,
            cycle_name=cycle_name,
            phase=AdmissionPhaseEnum.SUBMISSION,
            is_open=False,
            max_seats=max_seats,
            current_seats=0,
            selected_count=0,
            result_date=result_date,
            start_date=start_date,
            end_date=end_date,
            created_by=created_by
        )
        self.db.add(cycle)
        self.db.flush()
        self.db.refresh(cycle)
        return cycle

    def get_cycle_by_id(self, cycle_id: str) -> Optional[AdmissionCycle]:
        """Get admission cycle by ID."""
        stmt = select(AdmissionCycle).where(AdmissionCycle.cycle_id == cycle_id)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def update_cycle(self, cycle_id: str, update_data: Dict[str, Any]) -> Optional[AdmissionCycle]:
        """Update admission cycle with provided data.

        Args:
            cycle_id: Cycle ID to update
            update_data: Dictionary of fields to update

        Returns:
            Optional[AdmissionCycle]: Updated cycle or None if not found
        """
        stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(**update_data)
            .returning(AdmissionCycle)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def increment_cycle_seats(self, cycle_id: str) -> bool:
        """Increment current seats for a cycle.

        Args:
            cycle_id: Cycle ID to increment

        Returns:
            bool: True if successful
        """
        stmt = update(AdmissionCycle).where(
            AdmissionCycle.cycle_id == cycle_id
        ).values(
            current_seats=AdmissionCycle.current_seats + 1
        )
        result = self.db.execute(stmt)
        return result.rowcount > 0

    def get_all_cycles(self, skip: int = 0, limit: int = 100) -> List[AdmissionCycle]:
        """Get all admission cycles ordered by created_at desc."""
        stmt = (
            select(AdmissionCycle)
            .order_by(AdmissionCycle.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_active_cycle(self) -> Optional[AdmissionCycle]:
        """Get currently active (open) admission cycle."""
        stmt = select(AdmissionCycle).where(AdmissionCycle.is_open == True)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def open_cycle(self, cycle_id: str) -> Optional[AdmissionCycle]:
        """Open an admission cycle (and close any other open cycle).

        Args:
            cycle_id: Cycle ID to open

        Returns:
            Optional[AdmissionCycle]: Opened cycle
        """
        # First, close all open cycles
        close_stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.is_open == True)
            .values(is_open=False)
        )
        self.db.execute(close_stmt)

        # Then open the specified cycle
        open_stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(is_open=True)
            .returning(AdmissionCycle)
        )
        result = self.db.execute(open_stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def close_cycle(self, cycle_id: str, closed_by: str) -> Optional[AdmissionCycle]:
        """Close an admission cycle.

        Args:
            cycle_id: Cycle ID to close
            closed_by: Admin ID who closed it

        Returns:
            Optional[AdmissionCycle]: Closed cycle
        """
        stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(
                is_open=False,
                closed_at=datetime.utcnow(),
                closed_by=closed_by
            )
            .returning(AdmissionCycle)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def update_cycle_phase(
        self,
        cycle_id: str,
        phase: AdmissionPhaseEnum
    ) -> Optional[AdmissionCycle]:
        """Update cycle phase.

        Args:
            cycle_id: Cycle ID
            phase: New phase

        Returns:
            Optional[AdmissionCycle]: Updated cycle
        """
        stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(phase=phase)
            .returning(AdmissionCycle)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def increment_cycle_seats(self, cycle_id: str) -> Optional[AdmissionCycle]:
        """Increment current_seats counter for a cycle."""
        stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(current_seats=AdmissionCycle.current_seats + 1)
            .returning(AdmissionCycle)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def update_selected_count(
        self,
        cycle_id: str,
        selected_count: int
    ) -> Optional[AdmissionCycle]:
        """Update selected applicants count.

        Args:
            cycle_id: Cycle ID
            selected_count: Number of selected applicants

        Returns:
            Optional[AdmissionCycle]: Updated cycle
        """
        stmt = (
            update(AdmissionCycle)
            .where(AdmissionCycle.cycle_id == cycle_id)
            .values(selected_count=selected_count)
            .returning(AdmissionCycle)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    # Selection Log Operations

    def create_selection_log(
        self,
        admission_cycle_id: str,
        selected_count: int,
        selection_criteria: dict,
        cutoff_score: float,
        executed_by: str,
        program_name: Optional[str] = None
    ) -> SelectionLog:
        """Create selection log entry.

        Args:
            admission_cycle_id: Cycle ID
            selected_count: Number selected
            selection_criteria: Criteria used for selection
            cutoff_score: Minimum score for selection
            executed_by: Admin ID who executed
            program_name: Optional program name

        Returns:
            SelectionLog: Created log entry
        """
        log = SelectionLog(
            admission_cycle_id=admission_cycle_id,
            program_name=program_name,
            selected_count=selected_count,
            selection_criteria=selection_criteria,
            cutoff_score=cutoff_score,
            executed_by=executed_by
        )
        self.db.add(log)
        self.db.flush()
        self.db.refresh(log)
        return log

    def get_selection_logs(self, cycle_id: str) -> List[SelectionLog]:
        """Get all selection logs for a cycle."""
        stmt = (
            select(SelectionLog)
            .where(SelectionLog.admission_cycle_id == cycle_id)
            .order_by(SelectionLog.executed_at.desc())
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())
