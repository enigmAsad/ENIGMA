"""Bias repository for managing bias detection, nudges, flags, and metrics."""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, and_, func

from src.database.models import (
    LiveBiasAnalysis,
    LiveNudge,
    BiasFlag,
    DriftMetric,
    AdminBiasHistory,
    SeverityEnum,
    NudgeTypeEnum,
    RecommendedActionEnum,
    AdminBiasStatusEnum,
)
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("bias_repository")


class BiasAnalysisRepository(BaseRepository[LiveBiasAnalysis]):
    """Repository for bias analysis operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(LiveBiasAnalysis, db)

    def create_analysis(
        self,
        transcript_id: int,
        interview_id: int,
        admin_id: str,
        bias_detected: bool,
        bias_types: Optional[List[str]],
        severity: SeverityEnum,
        confidence_score: float,
        evidence_quotes: Optional[List[str]],
        context_summary: Optional[str],
        recommended_action: RecommendedActionEnum,
        llm_model: str,
        llm_response_raw: Optional[Dict[str, Any]] = None,
    ) -> LiveBiasAnalysis:
        """Create a new bias analysis result.

        Args:
            transcript_id: ID of the analyzed transcript
            interview_id: ID of the interview
            admin_id: ID of the admin being monitored
            bias_detected: Whether bias was detected
            bias_types: Types of bias detected
            severity: Severity level
            confidence_score: LLM confidence (0.0-1.0)
            evidence_quotes: Direct quotes showing bias
            context_summary: LLM explanation
            recommended_action: Recommended response
            llm_model: Model used for analysis
            llm_response_raw: Full LLM response

        Returns:
            LiveBiasAnalysis: The created analysis object
        """
        analysis = LiveBiasAnalysis(
            transcript_id=transcript_id,
            interview_id=interview_id,
            admin_id=admin_id,
            bias_detected=bias_detected,
            bias_types=bias_types,
            severity=severity,
            confidence_score=confidence_score,
            evidence_quotes=evidence_quotes,
            context_summary=context_summary,
            recommended_action=recommended_action,
            llm_model=llm_model,
            llm_response_raw=llm_response_raw,
        )
        return self.create(analysis)

    def get_by_interview_id(self, interview_id: int) -> List[LiveBiasAnalysis]:
        """Get all bias analyses for an interview."""
        stmt = (
            select(LiveBiasAnalysis)
            .where(LiveBiasAnalysis.interview_id == interview_id)
            .order_by(LiveBiasAnalysis.analyzed_at.asc())
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_by_admin_id(
        self,
        admin_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[LiveBiasAnalysis]:
        """Get all bias analyses for an admin.

        Args:
            admin_id: The admin ID
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of bias analyses
        """
        stmt = select(LiveBiasAnalysis).where(LiveBiasAnalysis.admin_id == admin_id)

        if start_date:
            stmt = stmt.where(LiveBiasAnalysis.analyzed_at >= start_date)
        if end_date:
            stmt = stmt.where(LiveBiasAnalysis.analyzed_at <= end_date)

        stmt = stmt.order_by(desc(LiveBiasAnalysis.analyzed_at))
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def count_incidents(
        self,
        admin_id: str,
        interview_id: Optional[int] = None,
        min_severity: Optional[SeverityEnum] = None,
    ) -> int:
        """Count bias incidents for an admin.

        Args:
            admin_id: The admin ID
            interview_id: Optional filter by interview
            min_severity: Optional minimum severity filter

        Returns:
            Count of incidents
        """
        stmt = select(func.count()).select_from(LiveBiasAnalysis).where(
            and_(
                LiveBiasAnalysis.admin_id == admin_id,
                LiveBiasAnalysis.bias_detected == True,
            )
        )

        if interview_id:
            stmt = stmt.where(LiveBiasAnalysis.interview_id == interview_id)

        if min_severity:
            # Filter by severity (assuming enum ordering)
            severity_levels = ["none", "low", "medium", "high", "critical"]
            min_index = severity_levels.index(min_severity.value)
            valid_severities = severity_levels[min_index:]
            stmt = stmt.where(LiveBiasAnalysis.severity.in_(valid_severities))

        result = self.db.execute(stmt)
        return result.scalar() or 0


class NudgeRepository(BaseRepository[LiveNudge]):
    """Repository for nudge operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(LiveNudge, db)

    def create_nudge(
        self,
        interview_id: int,
        analysis_id: int,
        admin_id: str,
        nudge_type: NudgeTypeEnum,
        message: str,
        display_duration: Optional[int] = None,
    ) -> LiveNudge:
        """Create a new nudge.

        Args:
            interview_id: ID of the interview
            analysis_id: ID of the bias analysis
            admin_id: ID of the admin receiving the nudge
            nudge_type: Type of nudge (info/warning/block)
            message: Message to display
            display_duration: Duration in seconds (None for blocks)

        Returns:
            LiveNudge: The created nudge object
        """
        nudge = LiveNudge(
            interview_id=interview_id,
            analysis_id=analysis_id,
            admin_id=admin_id,
            nudge_type=nudge_type,
            message=message,
            display_duration=display_duration,
        )
        return self.create(nudge)

    def get_by_interview_id(self, interview_id: int) -> List[LiveNudge]:
        """Get all nudges for an interview."""
        stmt = (
            select(LiveNudge)
            .where(LiveNudge.interview_id == interview_id)
            .order_by(LiveNudge.created_at.asc())
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def acknowledge_nudge(self, nudge_id: int) -> Optional[LiveNudge]:
        """Mark a nudge as acknowledged.

        Args:
            nudge_id: The nudge ID

        Returns:
            Updated nudge or None
        """
        nudge = self.get_by_id(nudge_id)
        if nudge:
            nudge.acknowledged = True
            nudge.acknowledged_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(nudge)
        return nudge

    def count_by_type(
        self,
        admin_id: str,
        interview_id: Optional[int] = None,
    ) -> Dict[str, int]:
        """Count nudges by type for an admin.

        Args:
            admin_id: The admin ID
            interview_id: Optional filter by interview

        Returns:
            Dictionary with counts per nudge type
        """
        stmt = select(LiveNudge).where(LiveNudge.admin_id == admin_id)

        if interview_id:
            stmt = stmt.where(LiveNudge.interview_id == interview_id)

        result = self.db.execute(stmt)
        nudges = list(result.scalars().all())

        counts = {
            "info": 0,
            "warning": 0,
            "block": 0,
        }

        for nudge in nudges:
            counts[nudge.nudge_type.value] += 1

        return counts


class BiasFlagRepository(BaseRepository[BiasFlag]):
    """Repository for bias flag operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(BiasFlag, db)

    def create_flag(
        self,
        interview_id: int,
        admin_id: str,
        application_id: Optional[str],
        flag_type: str,
        severity: SeverityEnum,
        description: str,
        evidence: Dict[str, Any],
        action_taken: str,
        automatic: bool = True,
    ) -> BiasFlag:
        """Create a new bias flag.

        Args:
            interview_id: ID of the interview
            admin_id: ID of the flagged admin
            application_id: Optional application ID
            flag_type: Type of flag
            severity: Severity level
            description: Description of the incident
            evidence: Evidence (quotes, analysis IDs, etc.)
            action_taken: Action taken
            automatic: Whether auto-triggered

        Returns:
            BiasFlag: The created flag object
        """
        flag = BiasFlag(
            interview_id=interview_id,
            admin_id=admin_id,
            application_id=application_id,
            flag_type=flag_type,
            severity=severity,
            description=description,
            evidence=evidence,
            action_taken=action_taken,
            automatic=automatic,
        )
        return self.create(flag)

    def get_unreviewed(self) -> List[BiasFlag]:
        """Get all unreviewed flags."""
        stmt = (
            select(BiasFlag)
            .where(BiasFlag.reviewed == False)
            .order_by(desc(BiasFlag.severity), BiasFlag.created_at.asc())
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_by_admin_id(self, admin_id: str) -> List[BiasFlag]:
        """Get all flags for an admin."""
        stmt = (
            select(BiasFlag)
            .where(BiasFlag.admin_id == admin_id)
            .order_by(desc(BiasFlag.created_at))
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def review_flag(
        self,
        flag_id: int,
        reviewed_by: str,
        resolution: str,
    ) -> Optional[BiasFlag]:
        """Mark a flag as reviewed.

        Args:
            flag_id: The flag ID
            reviewed_by: Admin ID who reviewed
            resolution: Resolution notes

        Returns:
            Updated flag or None
        """
        flag = self.get_by_id(flag_id)
        if flag:
            flag.reviewed = True
            flag.reviewed_by = reviewed_by
            flag.reviewed_at = datetime.now(timezone.utc)
            flag.resolution = resolution
            self.db.commit()
            self.db.refresh(flag)
        return flag


class DriftMetricsRepository(BaseRepository[DriftMetric]):
    """Repository for drift metrics operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(DriftMetric, db)

    def create_metric(
        self,
        admin_id: str,
        admission_cycle_id: Optional[str],
        period_start: datetime,
        period_end: datetime,
        **metrics: Any,
    ) -> DriftMetric:
        """Create a new drift metric record.

        Args:
            admin_id: The admin ID
            admission_cycle_id: Optional cycle ID
            period_start: Start of measurement period
            period_end: End of measurement period
            **metrics: Additional metric fields

        Returns:
            DriftMetric: The created metric object
        """
        metric = DriftMetric(
            admin_id=admin_id,
            admission_cycle_id=admission_cycle_id,
            period_start=period_start,
            period_end=period_end,
            **metrics,
        )
        return self.create(metric)

    def get_latest_for_admin(self, admin_id: str) -> Optional[DriftMetric]:
        """Get the most recent drift metric for an admin."""
        stmt = (
            select(DriftMetric)
            .where(DriftMetric.admin_id == admin_id)
            .order_by(desc(DriftMetric.calculated_at))
            .limit(1)
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_cycle(self, cycle_id: str) -> List[DriftMetric]:
        """Get all drift metrics for a cycle."""
        stmt = (
            select(DriftMetric)
            .where(DriftMetric.admission_cycle_id == cycle_id)
            .order_by(desc(DriftMetric.calculated_at))
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())


class AdminBiasHistoryRepository(BaseRepository[AdminBiasHistory]):
    """Repository for admin bias history operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(AdminBiasHistory, db)

    def get_or_create(self, admin_id: str) -> AdminBiasHistory:
        """Get or create bias history for an admin.

        Args:
            admin_id: The admin ID

        Returns:
            AdminBiasHistory: The history object
        """
        stmt = select(AdminBiasHistory).where(AdminBiasHistory.admin_id == admin_id)
        result = self.db.execute(stmt)
        history = result.scalar_one_or_none()

        if not history:
            history = AdminBiasHistory(admin_id=admin_id)
            self.db.add(history)
            self.db.commit()
            self.db.refresh(history)

        return history

    def increment_interview(self, admin_id: str) -> AdminBiasHistory:
        """Increment interview count for an admin."""
        history = self.get_or_create(admin_id)
        history.total_interviews_conducted += 1
        history.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(history)
        return history

    def add_incident(
        self,
        admin_id: str,
        severity: SeverityEnum,
        is_block: bool = False,
    ) -> AdminBiasHistory:
        """Record a bias incident for an admin.

        Args:
            admin_id: The admin ID
            severity: Severity of the incident
            is_block: Whether this was a block

        Returns:
            Updated AdminBiasHistory
        """
        history = self.get_or_create(admin_id)
        history.total_bias_incidents += 1

        if is_block:
            history.total_blocks_received += 1

        # Add strikes based on severity
        strike_map = {
            SeverityEnum.LOW: 0,
            SeverityEnum.MEDIUM: 1,
            SeverityEnum.HIGH: 2,
            SeverityEnum.CRITICAL: 3,
        }
        history.strikes += strike_map.get(severity, 0)
        history.last_incident_date = datetime.now(timezone.utc)

        # Update status based on strikes
        if history.strikes >= 10:
            history.current_status = AdminBiasStatusEnum.BANNED
        elif history.strikes >= 5:
            history.current_status = AdminBiasStatusEnum.SUSPENDED
            history.suspension_count += 1
        elif history.strikes >= 3:
            history.current_status = AdminBiasStatusEnum.WARNED

        history.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(history)
        return history

    def reset_strikes(self, admin_id: str) -> AdminBiasHistory:
        """Reset strikes for an admin (90-day clean record).

        Args:
            admin_id: The admin ID

        Returns:
            Updated AdminBiasHistory
        """
        history = self.get_or_create(admin_id)
        history.strikes = 0
        history.strike_reset_date = datetime.now(timezone.utc)
        history.current_status = AdminBiasStatusEnum.ACTIVE
        history.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(history)
        return history

    def get_high_risk_admins(self) -> List[AdminBiasHistory]:
        """Get admins with suspended or banned status."""
        stmt = select(AdminBiasHistory).where(
            AdminBiasHistory.current_status.in_([
                AdminBiasStatusEnum.SUSPENDED,
                AdminBiasStatusEnum.BANNED,
            ])
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())
