"""Batch repository for managing LLM batch processing operations."""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, update

from src.database.models import BatchRun, BatchTypeEnum, BatchStatusEnum
from src.database.repositories.base_repository import BaseRepository
from src.utils.logger import get_logger

logger = get_logger("batch_repository")


class BatchRepository(BaseRepository[BatchRun]):
    """Repository for batch processing operations."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(BatchRun, db)

    def create_batch_run(
        self,
        admission_cycle_id: str,
        batch_type: BatchTypeEnum,
        model_name: str,
        input_file_path: str,
        total_records: int,
        triggered_by: str,
        model_version: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> BatchRun:
        """Create a new batch run.

        Args:
            admission_cycle_id: Cycle ID
            batch_type: Type of batch (worker or judge)
            model_name: LLM model name
            input_file_path: Path to JSONL input file
            total_records: Total number of records to process
            triggered_by: Admin ID who triggered
            model_version: Optional model version
            metadata: Optional metadata dict

        Returns:
            BatchRun: Created batch run
        """
        batch = BatchRun(
            admission_cycle_id=admission_cycle_id,
            batch_type=batch_type,
            model_name=model_name,
            model_version=model_version,
            input_file_path=input_file_path,
            total_records=total_records,
            processed_records=0,
            failed_records=0,
            status=BatchStatusEnum.PENDING,
            triggered_by=triggered_by,
            metadata=metadata
        )
        self.db.add(batch)
        self.db.flush()
        self.db.refresh(batch)
        return batch

    def get_batch_by_id(self, batch_id: int) -> Optional[BatchRun]:
        """Get batch run by ID."""
        return self.get_by_id(batch_id, "batch_id")

    def get_batches_by_cycle(
        self,
        cycle_id: str,
        batch_type: Optional[BatchTypeEnum] = None,
        status: Optional[BatchStatusEnum] = None
    ) -> List[BatchRun]:
        """Get all batch runs for a cycle.

        Args:
            cycle_id: Admission cycle ID
            batch_type: Optional batch type filter
            status: Optional status filter

        Returns:
            List[BatchRun]: List of batch runs
        """
        stmt = select(BatchRun).where(
            BatchRun.admission_cycle_id == cycle_id
        )

        if batch_type:
            stmt = stmt.where(BatchRun.batch_type == batch_type)

        if status:
            stmt = stmt.where(BatchRun.status == status)

        stmt = stmt.order_by(BatchRun.started_at.desc())

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def start_batch(
        self,
        batch_id: int
    ) -> Optional[BatchRun]:
        """Mark batch as running.

        Args:
            batch_id: Batch ID

        Returns:
            Optional[BatchRun]: Updated batch run
        """
        stmt = (
            update(BatchRun)
            .where(BatchRun.batch_id == batch_id)
            .values(
                status=BatchStatusEnum.RUNNING,
                started_at=datetime.utcnow()
            )
            .returning(BatchRun)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def complete_batch(
        self,
        batch_id: int,
        output_file_path: str,
        processed_records: int,
        failed_records: int = 0
    ) -> Optional[BatchRun]:
        """Mark batch as completed.

        Args:
            batch_id: Batch ID
            output_file_path: Path to JSONL output file
            processed_records: Number of successfully processed records
            failed_records: Number of failed records

        Returns:
            Optional[BatchRun]: Updated batch run
        """
        stmt = (
            update(BatchRun)
            .where(BatchRun.batch_id == batch_id)
            .values(
                status=BatchStatusEnum.COMPLETED,
                output_file_path=output_file_path,
                processed_records=processed_records,
                failed_records=failed_records,
                completed_at=datetime.utcnow()
            )
            .returning(BatchRun)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def fail_batch(
        self,
        batch_id: int,
        error_log: str
    ) -> Optional[BatchRun]:
        """Mark batch as failed.

        Args:
            batch_id: Batch ID
            error_log: Error message/log

        Returns:
            Optional[BatchRun]: Updated batch run
        """
        stmt = (
            update(BatchRun)
            .where(BatchRun.batch_id == batch_id)
            .values(
                status=BatchStatusEnum.FAILED,
                error_log=error_log,
                completed_at=datetime.utcnow()
            )
            .returning(BatchRun)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def cancel_batch(self, batch_id: int) -> Optional[BatchRun]:
        """Cancel a batch run.

        Args:
            batch_id: Batch ID

        Returns:
            Optional[BatchRun]: Updated batch run
        """
        stmt = (
            update(BatchRun)
            .where(BatchRun.batch_id == batch_id)
            .values(
                status=BatchStatusEnum.CANCELLED,
                completed_at=datetime.utcnow()
            )
            .returning(BatchRun)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def update_progress(
        self,
        batch_id: int,
        processed_records: int,
        failed_records: int = 0
    ) -> Optional[BatchRun]:
        """Update batch processing progress.

        Args:
            batch_id: Batch ID
            processed_records: Current processed count
            failed_records: Current failed count

        Returns:
            Optional[BatchRun]: Updated batch run
        """
        stmt = (
            update(BatchRun)
            .where(BatchRun.batch_id == batch_id)
            .values(
                processed_records=processed_records,
                failed_records=failed_records
            )
            .returning(BatchRun)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def get_running_batches(self) -> List[BatchRun]:
        """Get all currently running batches.

        Returns:
            List[BatchRun]: Running batches
        """
        stmt = select(BatchRun).where(
            BatchRun.status == BatchStatusEnum.RUNNING
        ).order_by(BatchRun.started_at)
        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def get_latest_batch(
        self,
        cycle_id: str,
        batch_type: BatchTypeEnum
    ) -> Optional[BatchRun]:
        """Get the latest batch run for a cycle and type.

        Args:
            cycle_id: Admission cycle ID
            batch_type: Batch type

        Returns:
            Optional[BatchRun]: Latest batch run or None
        """
        stmt = (
            select(BatchRun)
            .where(
                BatchRun.admission_cycle_id == cycle_id,
                BatchRun.batch_type == batch_type
            )
            .order_by(BatchRun.started_at.desc())
            .limit(1)
        )
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()
