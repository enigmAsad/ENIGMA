"""Audit repository for managing audit logs and hash chain."""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from src.database.models import AuditLog, HashChain, AuditActionEnum
# Note: AuditRepository manages heterogeneous models, so it does not extend BaseRepository
from src.utils.logger import get_logger

logger = get_logger("audit_repository")


class AuditRepository:
    """Repository for audit logging and hash chain operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        self.db = db

    # Audit Log Operations

    def create_audit_log(
        self,
        entity_type: str,
        entity_id: str,
        action: AuditActionEnum,
        actor: str,
        details: Optional[dict] = None,
        metadata: Optional[dict] = None
    ) -> AuditLog:
        """Create audit log entry.

        Args:
            entity_type: Type of entity (Application, AdminUser, etc.)
            entity_id: Entity ID
            action: Action performed
            actor: Who performed the action
            details: Optional action details
            metadata: Optional metadata

        Returns:
            AuditLog: Created audit log
        """
        # Get previous hash for chain
        previous_hash = self.get_latest_audit_hash()

        # Create log entry
        log = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor=actor,
            details=details,
            metadata=metadata,
            previous_hash=previous_hash
        )

        self.db.add(log)
        self.db.flush()
        self.db.refresh(log)

        # Compute current hash (simplified - in production, use proper hash chain)
        import hashlib
        import json
        data_to_hash = {
            "log_id": log.log_id,
            "timestamp": log.timestamp.isoformat(),
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action.value,
            "actor": log.actor,
            "previous_hash": previous_hash or "genesis"
        }
        current_hash = hashlib.sha256(
            json.dumps(data_to_hash, sort_keys=True).encode()
        ).hexdigest()

        # Update with hash
        log.current_hash = current_hash
        self.db.flush()
        self.db.refresh(log)

        return log

    def get_latest_audit_hash(self) -> Optional[str]:
        """Get the hash of the most recent audit log entry.

        Returns:
            Optional[str]: Latest hash or None
        """
        stmt = (
            select(AuditLog.current_hash)
            .order_by(AuditLog.timestamp.desc())
            .limit(1)
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_audit_logs(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        actor: Optional[str] = None,
        action: Optional[AuditActionEnum] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[AuditLog]:
        """Get audit logs with optional filters.

        Args:
            entity_type: Optional entity type filter
            entity_id: Optional entity ID filter
            actor: Optional actor filter
            action: Optional action filter
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            List[AuditLog]: List of audit logs
        """
        stmt = select(AuditLog)

        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)

        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)

        if actor:
            stmt = stmt.where(AuditLog.actor == actor)

        if action:
            stmt = stmt.where(AuditLog.action == action)

        stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_audit_chain(self, limit: int = 1000) -> List[AuditLog]:
        """Get audit log chain for verification.

        Args:
            limit: Maximum entries to return

        Returns:
            List[AuditLog]: Audit logs in chronological order
        """
        stmt = (
            select(AuditLog)
            .order_by(AuditLog.timestamp.asc())
            .limit(limit)
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def verify_audit_chain(self) -> bool:
        """Verify integrity of audit log chain.

        Returns:
            bool: True if chain is valid, False otherwise
        """
        logs = self.get_audit_chain(limit=10000)

        if not logs:
            return True  # Empty chain is valid

        import hashlib
        import json

        for i, log in enumerate(logs):
            # Verify previous_hash matches
            if i == 0:
                expected_prev_hash = None
            else:
                expected_prev_hash = logs[i - 1].current_hash

            if log.previous_hash != expected_prev_hash:
                logger.error(
                    f"Audit chain broken at log {log.log_id}: "
                    f"expected previous_hash={expected_prev_hash}, "
                    f"got={log.previous_hash}"
                )
                return False

            # Verify current_hash is correct
            data_to_hash = {
                "log_id": log.log_id,
                "timestamp": log.timestamp.isoformat(),
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "action": log.action.value,
                "actor": log.actor,
                "previous_hash": log.previous_hash or "genesis"
            }
            expected_hash = hashlib.sha256(
                json.dumps(data_to_hash, sort_keys=True).encode()
            ).hexdigest()

            if log.current_hash != expected_hash:
                logger.error(
                    f"Audit chain broken at log {log.log_id}: "
                    f"hash mismatch expected={expected_hash}, got={log.current_hash}"
                )
                return False

        return True

    # Hash Chain Operations (for application decisions)

    def create_hash_chain_entry(
        self,
        anonymized_id: str,
        decision_type: str,
        data_json: str,
        data_hash: str,
        previous_hash: str
    ) -> HashChain:
        """Persist a hash chain entry and return ORM object."""
        entry = HashChain(
            anonymized_id=anonymized_id,
            decision_type=decision_type,
            data_json=data_json,
            data_hash=data_hash,
            previous_hash=previous_hash
        )

        self.db.add(entry)
        self.db.flush()
        self.db.refresh(entry)
        return entry

    # Backwards-compatible alias used by older callers
    def create_hash_entry(self, entry: HashChain) -> HashChain:
        self.db.add(entry)
        self.db.flush()
        self.db.refresh(entry)
        return entry

    def get_latest_hash_chain_entry_hash(self) -> Optional[str]:
        """Get the previous_hash for the next hash chain entry.

        Returns:
            Optional[str]: Latest hash or None
        """
        stmt = (
            select(HashChain.data_hash)
            .order_by(HashChain.timestamp.desc())
            .limit(1)
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_hash_chain_entries(
        self,
        anonymized_id: Optional[str] = None
    ) -> List[HashChain]:
        """Get hash chain entries.

        Args:
            anonymized_id: Optional filter by anonymized ID

        Returns:
            List[HashChain]: Hash chain entries
        """
        stmt = select(HashChain)

        if anonymized_id:
            stmt = stmt.where(HashChain.anonymized_id == anonymized_id)

        stmt = stmt.order_by(HashChain.timestamp.asc())

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def verify_hash_chain(self) -> bool:
        """Verify integrity of hash chain.

        Returns:
            bool: True if chain is valid, False otherwise
        """
        entries = self.get_hash_chain_entries()

        if not entries:
            return True

        import hashlib

        for i, entry in enumerate(entries):
            # Verify previous_hash linkage
            if i == 0:
                expected_prev_hash = "0" * 64
            else:
                expected_prev_hash = entries[i - 1].data_hash

            if entry.previous_hash != expected_prev_hash:
                logger.error(
                    f"Hash chain broken at entry {entry.chain_id}: "
                    f"expected previous_hash={expected_prev_hash}, "
                    f"got={entry.previous_hash}"
                )
                return False

            # Verify data_hash is correct
            expected_data_hash = hashlib.sha256(entry.data_json.encode()).hexdigest()

            if entry.data_hash != expected_data_hash:
                logger.error(
                    f"Hash chain broken at entry {entry.chain_id}: "
                    f"data hash mismatch expected={expected_data_hash}, "
                    f"got={entry.data_hash}"
                )
                return False

        return True

    def get_hash_chain(self) -> List[HashChain]:
        """Get all hash chain entries ordered by timestamp."""
        stmt = select(HashChain).order_by(HashChain.timestamp.asc())
        result = self.db.execute(stmt)
        return list(result.scalars().all())
