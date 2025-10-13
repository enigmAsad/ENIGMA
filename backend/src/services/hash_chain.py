"""Hash chain generator for tamper-evident audit trail."""

import hashlib
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

from src.models.schemas import HashChainEntry as HashChainSchema, FinalScore
from src.database.models import HashChain as HashChainModel
from src.database.repositories import AuditRepository
from src.utils.logger import get_logger, AuditLogger
from sqlalchemy.orm import Session


logger = get_logger("hash_chain")


class HashChainGenerator:
    """Cryptographic hash chain generator for tamper detection."""

    # Genesis hash for the first entry in the chain
    GENESIS_HASH = "0" * 64

    def __init__(self, db: Session, audit_logger: Optional[AuditLogger] = None):
        """Initialize hash chain generator.

        Args:
            db: Database session
            audit_logger: Optional AuditLogger instance
        """
        self.db = db
        self.audit_repo = AuditRepository(db)
        self.audit_logger = audit_logger
        self._chain_cache: Optional[List[HashChainSchema]] = None

    def generate_hash(self, data: Dict[str, Any], previous_hash: str) -> str:
        """Generate SHA-256 hash linking to previous decision.

        Args:
            data: Data to hash (will be JSON serialized)
            previous_hash: Hash of the previous chain entry

        Returns:
            str: 64-character hexadecimal SHA-256 hash
        """
        # Serialize data to JSON with sorted keys for consistency
        data_json = json.dumps(data, sort_keys=True, default=str)

        # Combine data with previous hash
        hash_input = f"{data_json}|{previous_hash}"

        # Generate SHA-256 hash
        hash_object = hashlib.sha256(hash_input.encode('utf-8'))
        hash_hex = hash_object.hexdigest()

        logger.debug(f"Generated hash: {hash_hex[:16]}... from previous: {previous_hash[:16]}...")

        return hash_hex

    def get_previous_hash(self) -> str:
        """Get the hash of the most recent chain entry.

        Returns:
            str: Previous hash, or GENESIS_HASH if chain is empty
        """
        # Use cached chain if available
        if self._chain_cache is None:
            self._chain_cache = self.audit_repo.get_hash_chain()

        if not self._chain_cache:
            return self.GENESIS_HASH

        # Return the most recent hash
        return self._chain_cache[-1].data_hash

    def create_hash_entry(
        self,
        anonymized_id: str,
        decision_type: str,
        decision_data: Dict[str, Any]
    ) -> HashChainSchema:
        """Create a new hash chain entry.

        Args:
            anonymized_id: Anonymized applicant ID
            decision_type: Type of decision (phase1_final, phase2_final, etc.)
            decision_data: Decision data to hash

        Returns:
            HashChainSchema: New hash chain entry
        """
        # Get previous hash
        previous_hash = self.get_previous_hash()

        # Serialize decision data
        data_json = json.dumps(decision_data, sort_keys=True, default=str)

        # Generate hash
        data_hash = self.generate_hash(decision_data, previous_hash)

        # Create Pydantic schema first to generate the chain_id
        hash_schema = HashChainSchema(
            anonymized_id=anonymized_id,
            decision_type=decision_type,
            data_json=data_json,
            data_hash=data_hash,
            previous_hash=previous_hash,
            timestamp=datetime.utcnow()
        )

        # Create SQLAlchemy model for persistence
        db_hash_entry = HashChainModel(**hash_schema.model_dump())

        # Persist to database
        self.audit_repo.create(db_hash_entry)

        # Update cache
        if self._chain_cache is None:
            self._chain_cache = []
        self._chain_cache.append(hash_schema)

        # Audit log
        if self.audit_logger:
            self.audit_logger.log_hash_generation(anonymized_id, data_hash)

        logger.info(f"Created hash chain entry for {anonymized_id}: {data_hash[:16]}...")

        return hash_schema

    def create_phase1_hash(self, final_score: FinalScore) -> str:
        """Create hash chain entry for Phase 1 final score.

        Args:
            final_score: FinalScore model

        Returns:
            str: Generated hash
        """
        # Prepare decision data
        decision_data = {
            "anonymized_id": final_score.anonymized_id,
            "final_score": final_score.final_score,
            "academic_score": final_score.academic_score,
            "test_score": final_score.test_score,
            "achievement_score": final_score.achievement_score,
            "essay_score": final_score.essay_score,
            "explanation": final_score.explanation,
            "strengths": final_score.strengths,
            "areas_for_improvement": final_score.areas_for_improvement,
            "worker_attempts": final_score.worker_attempts,
            "timestamp": final_score.timestamp.isoformat()
        }

        # Create hash entry
        hash_entry = self.create_hash_entry(
            anonymized_id=final_score.anonymized_id,
            decision_type="phase1_final",
            decision_data=decision_data
        )

        return hash_entry.data_hash

    def verify_entry(
        self,
        entry: HashChainSchema,
        previous_entry: Optional[HashChainSchema] = None
    ) -> bool:
        """Verify a single hash chain entry.

        Args:
            entry: Hash chain entry to verify
            previous_entry: Previous entry in the chain (None for first entry)

        Returns:
            bool: True if entry is valid
        """
        # Get expected previous hash
        expected_previous = (
            previous_entry.data_hash if previous_entry
            else self.GENESIS_HASH
        )

        # Check previous hash link
        if entry.previous_hash != expected_previous:
            logger.error(
                f"Hash chain break: Entry {entry.chain_id} has incorrect previous_hash. "
                f"Expected: {expected_previous[:16]}..., Got: {entry.previous_hash[:16]}..."
            )
            return False

        # Reconstruct data from JSON
        try:
            data = json.loads(entry.data_json)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in hash entry {entry.chain_id}: {e}")
            return False

        # Recalculate hash
        calculated_hash = self.generate_hash(data, entry.previous_hash)

        # Verify hash matches
        if calculated_hash != entry.data_hash:
            logger.error(
                f"Hash mismatch: Entry {entry.chain_id}. "
                f"Expected: {calculated_hash[:16]}..., Got: {entry.data_hash[:16]}..."
            )
            return False

        return True

    def verify_chain(self, chain: Optional[List[HashChainSchema]] = None) -> Dict[str, Any]:
        """Verify integrity of entire hash chain.

        Args:
            chain: Optional chain to verify (defaults to full chain from database)

        Returns:
            Dict[str, Any]: Verification result with details
        """
        if chain is None:
            chain = self.audit_repo.get_hash_chain()

        if not chain:
            return {
                "is_valid": True,
                "chain_length": 0,
                "message": "Chain is empty (valid state)"
            }

        is_valid = True
        invalid_entries = []

        for i, entry in enumerate(chain):
            previous_entry = chain[i - 1] if i > 0 else None

            if not self.verify_entry(entry, previous_entry):
                is_valid = False
                invalid_entries.append({
                    "index": i,
                    "chain_id": entry.chain_id,
                    "anonymized_id": entry.anonymized_id,
                    "timestamp": entry.timestamp.isoformat()
                })

        result = {
            "is_valid": is_valid,
            "chain_length": len(chain),
            "invalid_entries": invalid_entries,
            "first_entry_timestamp": chain[0].timestamp.isoformat() if chain else None,
            "last_entry_timestamp": chain[-1].timestamp.isoformat() if chain else None
        }

        if is_valid:
            result["message"] = f"Chain is valid ({len(chain)} entries verified)"
            logger.info(f"Hash chain verification passed: {len(chain)} entries")
        else:
            result["message"] = f"Chain has {len(invalid_entries)} invalid entries"
            logger.error(f"Hash chain verification failed: {len(invalid_entries)} invalid entries")

        return result

    def verify_decision(self, anonymized_id: str, expected_hash: str) -> Dict[str, Any]:
        """Verify a specific decision by its hash.

        Args:
            anonymized_id: Anonymized applicant ID
            expected_hash: Expected hash value

        Returns:
            Dict[str, Any]: Verification result
        """
        chain = self.audit_repo.get_hash_chain()

        # Find entry with matching anonymized_id
        matching_entries = [
            entry for entry in chain
            if entry.anonymized_id == anonymized_id
        ]

        if not matching_entries:
            return {
                "is_valid": False,
                "message": f"No hash chain entry found for {anonymized_id}",
                "expected_hash": expected_hash,
                "found_hash": None
            }

        # Get the most recent entry for this ID
        latest_entry = max(matching_entries, key=lambda e: e.timestamp)

        # Verify hash matches
        if latest_entry.data_hash != expected_hash:
            return {
                "is_valid": False,
                "message": "Hash mismatch - decision may have been tampered with",
                "expected_hash": expected_hash,
                "found_hash": latest_entry.data_hash,
                "entry": {
                    "chain_id": latest_entry.chain_id,
                    "decision_type": latest_entry.decision_type,
                    "timestamp": latest_entry.timestamp.isoformat()
                }
            }

        # Verify the entry's integrity within the chain
        entry_index = chain.index(latest_entry)
        previous_entry = chain[entry_index - 1] if entry_index > 0 else None

        if not self.verify_entry(latest_entry, previous_entry):
            return {
                "is_valid": False,
                "message": "Entry hash is correct but chain integrity is broken",
                "expected_hash": expected_hash,
                "found_hash": latest_entry.data_hash,
                "entry": {
                    "chain_id": latest_entry.chain_id,
                    "decision_type": latest_entry.decision_type,
                    "timestamp": latest_entry.timestamp.isoformat()
                }
            }

        return {
            "is_valid": True,
            "message": "Decision verified successfully",
            "expected_hash": expected_hash,
            "found_hash": latest_entry.data_hash,
            "entry": {
                "chain_id": latest_entry.chain_id,
                "decision_type": latest_entry.decision_type,
                "timestamp": latest_entry.timestamp.isoformat(),
                "data": json.loads(latest_entry.data_json)
            }
        }

    def invalidate_cache(self):
        """Invalidate the cached hash chain.

        Call this when the chain is modified externally.
        """
        self._chain_cache = None
        logger.debug("Hash chain cache invalidated")
