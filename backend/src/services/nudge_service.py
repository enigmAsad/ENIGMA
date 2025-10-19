"""Nudge service for graduated bias response and admin strike management."""

from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from src.database.repositories.bias_repository import (
    BiasAnalysisRepository,
    NudgeRepository,
    BiasFlagRepository,
    AdminBiasHistoryRepository,
)
from src.database.models import (
    SeverityEnum,
    NudgeTypeEnum,
    RecommendedActionEnum,
    AdminBiasStatusEnum,
)
from src.utils.logger import get_logger

logger = get_logger("nudge_service")


# Nudge message templates
NUDGE_MESSAGES = {
    "info_appearance": "💡 Reminder: Please focus on the candidate's qualifications and communication skills, not physical appearance.",
    "info_socioeconomic": "💡 Reminder: Please evaluate based on academic merit, not socioeconomic background.",
    "info_accent": "💡 Reminder: Please focus on the clarity of ideas, not accent or pronunciation.",
    "info_general": "💡 Reminder: Please ensure your questions focus on merit-based criteria only.",

    "warning_appearance": "⚠️ Warning: Your recent comment referenced physical appearance. Please refocus on academic qualifications. (Strike added)",
    "warning_gender": "⚠️ Warning: Gender-based references detected. Please maintain focus on merit criteria. (Strike added)",
    "warning_personal": "⚠️ Warning: Personal connections should not influence evaluation. Please focus on the candidate's qualifications. (Strike added)",
    "warning_general": "⚠️ Warning: Your comments may contain bias. Please refocus on merit-based evaluation. (Strike added)",

    "block_critical": "🛑 INTERVIEW TERMINATED: Critical bias detected. This session has been flagged for review. You cannot continue this interview.",
    "block_strikes": "🛑 INTERVIEW TERMINATED: Multiple bias violations detected (3 strikes). This session has been flagged for review.",
    "block_suspended": "🛑 ACCESS BLOCKED: You have been temporarily suspended from conducting interviews due to repeated bias violations. Please contact administration.",
}


class NudgeService:
    """Service for managing nudges, strikes, and admin escalation."""

    def __init__(self, db: Session):
        """Initialize nudge service.

        Args:
            db: Database session
        """
        self.db = db
        self.analysis_repo = BiasAnalysisRepository(db)
        self.nudge_repo = NudgeRepository(db)
        self.flag_repo = BiasFlagRepository(db)
        self.history_repo = AdminBiasHistoryRepository(db)

        # Strike thresholds from config
        self.strike_limit_per_interview = 3
        self.strike_limit_per_cycle = 5
        self.strike_reset_days = 90

    async def process_bias_detection(
        self,
        analysis_id: int,
        interview_id: int,
        admin_id: str,
        bias_detected: bool,
        severity: SeverityEnum,
        recommended_action: RecommendedActionEnum,
        confidence_score: float,
        bias_types: Optional[list] = None,
        evidence: Optional[dict] = None,
    ) -> Optional[Dict[str, Any]]:
        """Process a bias detection and determine appropriate nudge.

        Args:
            analysis_id: ID of the bias analysis
            interview_id: ID of the interview
            admin_id: ID of the admin
            bias_detected: Whether bias was detected
            severity: Severity level
            recommended_action: Recommended action from LLM
            confidence_score: Confidence score
            bias_types: Types of bias detected
            evidence: Evidence dictionary

        Returns:
            Nudge data if one was created, None otherwise
        """
        if not bias_detected or recommended_action == RecommendedActionEnum.NONE:
            return None

        # Check if admin is already suspended/banned
        history = self.history_repo.get_or_create(admin_id)
        if history.current_status in [AdminBiasStatusEnum.SUSPENDED, AdminBiasStatusEnum.BANNED]:
            logger.warning(f"Admin {admin_id} is {history.current_status.value}, blocking interview")
            return await self._block_interview(
                interview_id=interview_id,
                admin_id=admin_id,
                analysis_id=analysis_id,
                reason="Admin is suspended/banned",
                evidence=evidence or {},
            )

        # Check strikes in this interview
        interview_strikes = self._count_interview_strikes(interview_id, admin_id)

        # Determine actual action based on strikes
        if interview_strikes >= self.strike_limit_per_interview:
            # Auto-block on 3rd strike in interview
            logger.warning(f"Admin {admin_id} hit strike limit in interview {interview_id}")
            return await self._block_interview(
                interview_id=interview_id,
                admin_id=admin_id,
                analysis_id=analysis_id,
                reason="Strike limit reached in interview",
                evidence=evidence or {},
            )

        # Deliver appropriate nudge
        if severity == SeverityEnum.CRITICAL or recommended_action == RecommendedActionEnum.BLOCK:
            return await self._block_interview(
                interview_id=interview_id,
                admin_id=admin_id,
                analysis_id=analysis_id,
                reason="Critical bias detected",
                evidence=evidence or {},
            )
        elif recommended_action == RecommendedActionEnum.WARN:
            return await self._deliver_warning(
                interview_id=interview_id,
                admin_id=admin_id,
                analysis_id=analysis_id,
                severity=severity,
                bias_types=bias_types or [],
            )
        elif recommended_action == RecommendedActionEnum.NUDGE:
            return await self._deliver_info_nudge(
                interview_id=interview_id,
                admin_id=admin_id,
                analysis_id=analysis_id,
                bias_types=bias_types or [],
            )

        return None

    async def _deliver_info_nudge(
        self,
        interview_id: int,
        admin_id: str,
        analysis_id: int,
        bias_types: list,
    ) -> Dict[str, Any]:
        """Deliver an informational nudge (blue banner, 5s display).

        Args:
            interview_id: Interview ID
            admin_id: Admin ID
            analysis_id: Analysis ID
            bias_types: Types of bias detected

        Returns:
            Nudge data
        """
        # Select message based on bias type
        primary_type = bias_types[0] if bias_types else "general"
        message_key = f"info_{primary_type}"
        message = NUDGE_MESSAGES.get(message_key, NUDGE_MESSAGES["info_general"])

        nudge = self.nudge_repo.create_nudge(
            interview_id=interview_id,
            analysis_id=analysis_id,
            admin_id=admin_id,
            nudge_type=NudgeTypeEnum.INFO,
            message=message,
            display_duration=5,  # 5 seconds
        )

        self.db.commit()

        logger.info(f"Delivered info nudge to admin {admin_id} in interview {interview_id}")

        return {
            "nudge_id": nudge.id,
            "nudge_type": "info",
            "message": message,
            "display_duration": 5,
        }

    async def _deliver_warning(
        self,
        interview_id: int,
        admin_id: str,
        analysis_id: int,
        severity: SeverityEnum,
        bias_types: list,
    ) -> Dict[str, Any]:
        """Deliver a warning nudge (yellow banner, 10s display, +strike).

        Args:
            interview_id: Interview ID
            admin_id: Admin ID
            analysis_id: Analysis ID
            severity: Severity level
            bias_types: Types of bias detected

        Returns:
            Nudge data
        """
        # Select message
        primary_type = bias_types[0] if bias_types else "general"
        message_key = f"warning_{primary_type}"
        message = NUDGE_MESSAGES.get(message_key, NUDGE_MESSAGES["warning_general"])

        nudge = self.nudge_repo.create_nudge(
            interview_id=interview_id,
            analysis_id=analysis_id,
            admin_id=admin_id,
            nudge_type=NudgeTypeEnum.WARNING,
            message=message,
            display_duration=10,  # 10 seconds
        )

        # Add strike to admin history
        self.history_repo.add_incident(
            admin_id=admin_id,
            severity=severity,
            is_block=False,
        )

        self.db.commit()

        logger.warning(f"Delivered warning to admin {admin_id} in interview {interview_id}")

        return {
            "nudge_id": nudge.id,
            "nudge_type": "warning",
            "message": message,
            "display_duration": 10,
        }

    async def _block_interview(
        self,
        interview_id: int,
        admin_id: str,
        analysis_id: int,
        reason: str,
        evidence: dict,
    ) -> Dict[str, Any]:
        """Block an interview and create a bias flag (red alert, interview terminated).

        Args:
            interview_id: Interview ID
            admin_id: Admin ID
            analysis_id: Analysis ID
            reason: Reason for blocking
            evidence: Evidence dictionary

        Returns:
            Nudge and flag data
        """
        # Determine message
        if "Strike limit" in reason:
            message = NUDGE_MESSAGES["block_strikes"]
        elif "suspended" in reason.lower() or "banned" in reason.lower():
            message = NUDGE_MESSAGES["block_suspended"]
        else:
            message = NUDGE_MESSAGES["block_critical"]

        # Create block nudge
        nudge = self.nudge_repo.create_nudge(
            interview_id=interview_id,
            analysis_id=analysis_id,
            admin_id=admin_id,
            nudge_type=NudgeTypeEnum.BLOCK,
            message=message,
            display_duration=None,  # No auto-dismiss for blocks
        )

        # Create bias flag
        flag = self.flag_repo.create_flag(
            interview_id=interview_id,
            admin_id=admin_id,
            application_id=None,  # Can be linked later if needed
            flag_type="interview_blocked",
            severity=SeverityEnum.CRITICAL,
            description=reason,
            evidence=evidence,
            action_taken="interview_terminated",
            automatic=True,
        )

        # Update admin history
        self.history_repo.add_incident(
            admin_id=admin_id,
            severity=SeverityEnum.CRITICAL,
            is_block=True,
        )

        # Update interview status to cancelled
        from src.database.repositories.interview_repository import InterviewRepository
        interview_repo = InterviewRepository(self.db)
        from src.database.models import InterviewStatusEnum
        interview_repo.update_interview(
            interview_id=interview_id,
            update_data={"status": InterviewStatusEnum.CANCELLED},
        )

        self.db.commit()

        logger.critical(f"BLOCKED interview {interview_id} for admin {admin_id}: {reason}")

        return {
            "nudge_id": nudge.id,
            "nudge_type": "block",
            "message": message,
            "flag_id": flag.id,
            "action": "interview_terminated",
        }

    def _count_interview_strikes(self, interview_id: int, admin_id: str) -> int:
        """Count strikes (warnings) in the current interview.

        Args:
            interview_id: Interview ID
            admin_id: Admin ID

        Returns:
            Strike count
        """
        nudge_counts = self.nudge_repo.count_by_type(
            admin_id=admin_id,
            interview_id=interview_id,
        )
        # Warnings and blocks count as strikes
        return nudge_counts.get("warning", 0) + nudge_counts.get("block", 0)

    def check_strike_reset(self, admin_id: str) -> bool:
        """Check if strikes should be reset (90 days clean).

        Args:
            admin_id: Admin ID

        Returns:
            True if strikes were reset
        """
        history = self.history_repo.get_or_create(admin_id)

        if not history.last_incident_date:
            return False

        # Check if 90 days have passed since last incident
        days_since_incident = (datetime.now(timezone.utc) - history.last_incident_date).days

        if days_since_incident >= self.strike_reset_days:
            logger.info(f"Resetting strikes for admin {admin_id} after {days_since_incident} days clean")
            self.history_repo.reset_strikes(admin_id)
            self.db.commit()
            return True

        return False

    def get_admin_status(self, admin_id: str) -> Dict[str, Any]:
        """Get current bias status for an admin.

        Args:
            admin_id: Admin ID

        Returns:
            Status dictionary
        """
        history = self.history_repo.get_or_create(admin_id)

        return {
            "admin_id": admin_id,
            "current_status": history.current_status.value,
            "strikes": history.strikes,
            "total_interviews": history.total_interviews_conducted,
            "total_incidents": history.total_bias_incidents,
            "total_blocks": history.total_blocks_received,
            "last_incident_date": history.last_incident_date.isoformat() if history.last_incident_date else None,
            "can_conduct_interviews": history.current_status == AdminBiasStatusEnum.ACTIVE,
        }
