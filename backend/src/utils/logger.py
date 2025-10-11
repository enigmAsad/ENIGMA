"""Logging utilities for ENIGMA Phase 1 backend."""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from functools import lru_cache

from src.config.settings import get_settings
from src.models.schemas import AuditLog


class AuditLogger:
    """Audit logger for tracking all system actions."""

    def __init__(self, csv_handler=None):
        """Initialize audit logger.

        Args:
            csv_handler: CSVHandler instance (injected to avoid circular import)
        """
        self.csv_handler = csv_handler
        self.settings = get_settings()
        self._logger = get_logger("audit")

    def log_action(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        actor: str,
        details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """Log an action to the audit trail.

        Args:
            entity_type: Type of entity (Application, WorkerResult, etc.)
            entity_id: ID of the affected entity
            action: Action performed (CREATE, UPDATE, DELETE, EVALUATE, etc.)
            actor: Who/what performed the action (system, worker_llm, judge_llm, user)
            details: Action-specific details
            metadata: Additional metadata

        Returns:
            AuditLog: The created audit log entry
        """
        # Create audit log entry
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor=actor,
            details=details or {},
            metadata=metadata or {}
        )

        # Write to CSV if handler is available
        if self.csv_handler:
            try:
                self.csv_handler.append_audit_log(audit_log)
            except Exception as e:
                self._logger.error(f"Failed to write audit log to CSV: {e}")

        # Log to application logger
        self._logger.info(
            f"AUDIT: {action} | {entity_type}:{entity_id} | actor={actor} | "
            f"details={details or {}} | timestamp={audit_log.timestamp.isoformat()}"
        )

        return audit_log

    def log_application_submitted(self, application_id: str) -> AuditLog:
        """Log application submission."""
        return self.log_action(
            entity_type="Application",
            entity_id=application_id,
            action="APPLICATION_SUBMITTED",
            actor="system",
            details={"stage": "intake"}
        )

    def log_identity_scrubbing(
        self,
        application_id: str,
        anonymized_id: str,
        pii_fields_removed: list
    ) -> AuditLog:
        """Log identity scrubbing action."""
        return self.log_action(
            entity_type="Application",
            entity_id=application_id,
            action="IDENTITY_SCRUBBED",
            actor="identity_scrubber",
            details={
                "anonymized_id": anonymized_id,
                "pii_fields_removed": pii_fields_removed
            }
        )

    def log_worker_evaluation(
        self,
        anonymized_id: str,
        worker_result_id: str,
        attempt_number: int,
        total_score: float
    ) -> AuditLog:
        """Log Worker LLM evaluation."""
        return self.log_action(
            entity_type="WorkerResult",
            entity_id=worker_result_id,
            action="WORKER_EVALUATION",
            actor="worker_llm",
            details={
                "anonymized_id": anonymized_id,
                "attempt_number": attempt_number,
                "total_score": total_score
            }
        )

    def log_judge_review(
        self,
        anonymized_id: str,
        judge_result_id: str,
        worker_result_id: str,
        decision: str,
        bias_detected: bool
    ) -> AuditLog:
        """Log Judge LLM review."""
        return self.log_action(
            entity_type="JudgeResult",
            entity_id=judge_result_id,
            action="JUDGE_REVIEW",
            actor="judge_llm",
            details={
                "anonymized_id": anonymized_id,
                "worker_result_id": worker_result_id,
                "decision": decision,
                "bias_detected": bias_detected
            }
        )

    def log_final_scoring(
        self,
        anonymized_id: str,
        final_score: float,
        attempts: int
    ) -> AuditLog:
        """Log final scoring."""
        return self.log_action(
            entity_type="FinalScore",
            entity_id=anonymized_id,
            action="FINAL_SCORING",
            actor="system",
            details={
                "final_score": final_score,
                "worker_attempts": attempts
            }
        )

    def log_hash_generation(
        self,
        anonymized_id: str,
        hash_value: str
    ) -> AuditLog:
        """Log hash chain generation."""
        return self.log_action(
            entity_type="HashChainEntry",
            entity_id=anonymized_id,
            action="HASH_GENERATED",
            actor="hash_chain_generator",
            details={"hash": hash_value}
        )

    def log_notification_sent(
        self,
        application_id: str,
        notification_type: str,
        recipient: str
    ) -> AuditLog:
        """Log email notification sent."""
        return self.log_action(
            entity_type="Notification",
            entity_id=application_id,
            action="NOTIFICATION_SENT",
            actor="email_service",
            details={
                "notification_type": notification_type,
                "recipient": recipient
            }
        )

    def log_error(
        self,
        entity_type: str,
        entity_id: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """Log an error occurrence."""
        return self.log_action(
            entity_type=entity_type,
            entity_id=entity_id,
            action="ERROR",
            actor="system",
            details={
                "error_message": error_message,
                "error_details": error_details or {}
            }
        )


@lru_cache()
def get_logger(name: str = "enigma") -> logging.Logger:
    """Get configured logger instance.

    Args:
        name: Logger name

    Returns:
        logging.Logger: Configured logger
    """
    logger = logging.getLogger(name)

    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger

    settings = get_settings()

    # Set log level
    logger.setLevel(getattr(logging, settings.log_level))

    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler (if configured)
    if settings.log_file:
        log_file_path = settings.log_file
        if not log_file_path.is_absolute():
            log_file_path = settings.log_dir / log_file_path

        # Ensure log directory exists
        log_file_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


def log_info(message: str, logger_name: str = "enigma"):
    """Log info message."""
    get_logger(logger_name).info(message)


def log_warning(message: str, logger_name: str = "enigma"):
    """Log warning message."""
    get_logger(logger_name).warning(message)


def log_error(message: str, logger_name: str = "enigma"):
    """Log error message."""
    get_logger(logger_name).error(message)


def log_debug(message: str, logger_name: str = "enigma"):
    """Log debug message."""
    get_logger(logger_name).debug(message)


def log_critical(message: str, logger_name: str = "enigma"):
    """Log critical message."""
    get_logger(logger_name).critical(message)
