"""Batch processing service for LLM evaluation workflows.

Handles:
- Phase 4: JSONL export of anonymized applications
- Phase 5: Batch LLM processing coordination
- Phase 6: JSONL import of LLM results
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from src.database.repositories import ApplicationRepository, BatchRepository
from src.database.models import (
    BatchTypeEnum, BatchStatusEnum, ApplicationStatusEnum,
    AnonymizedApplication
)
from src.config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("batch_processor")


class BatchProcessingService:
    """Service for batch processing operations."""

    def __init__(self, db: Session):
        """Initialize batch processing service.

        Args:
            db: Database session
        """
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.batch_repo = BatchRepository(db)
        self.settings = get_settings()

    def export_applications_to_jsonl(
        self,
        cycle_id: str,
        output_filename: Optional[str] = None
    ) -> tuple[str, int]:
        """Export finalized applications to JSONL format for batch LLM processing.

        Phase 4: Batch Preparation

        Args:
            cycle_id: Admission cycle ID
            output_filename: Optional custom filename

        Returns:
            tuple[str, int]: (file_path, record_count)

        Raises:
            ValueError: If no finalized applications found
        """
        logger.info(f"Exporting applications for cycle {cycle_id} to JSONL")

        # Get all applications ready for batch export
        applications = self.app_repo.get_by_cycle(
            cycle_id,
            status=ApplicationStatusEnum.BATCH_READY,
            limit=10000  # Adjust as needed
        )

        if not applications:
            raise ValueError(f"No applications ready for batch export found for cycle {cycle_id}")

        # Create export directory if not exists
        export_dir = self.settings.batch_export_dir
        export_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename
        if not output_filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            output_filename = f"batch_export_{cycle_id}_{timestamp}.jsonl"

        output_path = export_dir / output_filename

        # Export to JSONL
        exported_count = 0
        with open(output_path, 'w', encoding='utf-8') as f:
            for app in applications:
                # Get anonymized version
                anon_app = self.app_repo.get_anonymized_by_application_id(app.application_id)

                if not anon_app:
                    logger.warning(f"No anonymized data for {app.application_id}, skipping")
                    continue

                # Get deterministic metrics if available
                metrics = self.app_repo.get_deterministic_metrics(app.application_id)

                # Create JSONL record
                record = {
                    "anonymized_id": anon_app.anonymized_id,
                    "gpa": anon_app.gpa,
                    "test_scores": anon_app.test_scores,
                    "essay": anon_app.essay_scrubbed,
                    "achievements": anon_app.achievements_scrubbed,
                    "prompt": self._generate_evaluation_prompt(anon_app, metrics)
                }

                # Write as single line JSON
                f.write(json.dumps(record) + '\n')
                exported_count += 1

        logger.info(f"Exported {exported_count} applications to {output_path}")
        return str(output_path), exported_count

    def _generate_evaluation_prompt(
        self,
        anon_app: AnonymizedApplication,
        metrics: Optional[Any] = None
    ) -> str:
        """Generate evaluation prompt for LLM.

        Args:
            anon_app: Anonymized application
            metrics: Optional deterministic metrics

        Returns:
            str: Formatted prompt for LLM
        """
        prompt = f"""You are an expert admissions evaluator. Evaluate this application objectively based on academic merit only.

**Academic Data:**
- GPA: {anon_app.gpa}/4.0
- Test Scores: {json.dumps(anon_app.test_scores)}
{f"- Computed Academic Score: {metrics.academic_score_computed}/100" if metrics else ""}

**Essay:**
{anon_app.essay_scrubbed}

**Achievements:**
{anon_app.achievements_scrubbed}

**Instructions:**
Evaluate this application on a 0-100 scale across four dimensions:
1. Academic Performance (30% weight)
2. Test Scores (25% weight)
3. Achievements (25% weight)
4. Essay Quality (20% weight)

Return a JSON object with:
{{
  "academic_score": <0-100>,
  "test_score": <0-100>,
  "achievement_score": <0-100>,
  "essay_score": <0-100>,
  "total_score": <weighted average>,
  "explanation": "<detailed reasoning>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "areas_for_improvement": ["<area 1>", "<area 2>", ...]
}}

Ensure your evaluation is:
- Free from demographic bias
- Evidence-based
- Aligned with the rubric
"""
        return prompt

    def import_llm_results_from_jsonl(
        self,
        batch_id: int,
        results_file_path: str
    ) -> int:
        """Import LLM batch results from JSONL file.

        Phase 6: Result Integration

        Args:
            batch_id: Batch run ID
            results_file_path: Path to JSONL results file

        Returns:
            int: Number of results imported

        Raises:
            FileNotFoundError: If results file doesn't exist
            ValueError: If batch not found or invalid
        """
        logger.info(f"Importing LLM results from {results_file_path} for batch {batch_id}")

        # Verify batch exists
        batch = self.batch_repo.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        results_path = Path(results_file_path)
        if not results_path.exists():
            raise FileNotFoundError(f"Results file not found: {results_file_path}")

        # Import results
        imported_count = 0
        failed_count = 0

        with open(results_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    result = json.loads(line.strip())

                    # Extract data
                    anonymized_id = result.get("anonymized_id")
                    llm_score = result.get("total_score")
                    llm_explanation = result.get("explanation")
                    academic_score = result.get("academic_score")
                    test_score = result.get("test_score")
                    achievement_score = result.get("achievement_score")
                    essay_score = result.get("essay_score")
                    strengths = result.get("strengths", [])
                    areas_for_improvement = result.get("areas_for_improvement", [])

                    if not anonymized_id:
                        logger.warning(f"Line {line_num}: Missing anonymized_id, skipping")
                        failed_count += 1
                        continue

                    # Check if final score already exists
                    existing_score = self.app_repo.get_final_score(anonymized_id)

                    if existing_score:
                        # Update existing with LLM results
                        from sqlalchemy import update
                        from src.database.models import FinalScore

                        stmt = (
                            update(FinalScore)
                            .where(FinalScore.anonymized_id == anonymized_id)
                            .values(
                                llm_score=llm_score,
                                llm_explanation=llm_explanation
                            )
                        )
                        self.db.execute(stmt)
                    else:
                        # Create new final score
                        from src.database.models import FinalScore

                        final_score = FinalScore(
                            anonymized_id=anonymized_id,
                            final_score=llm_score,
                            academic_score=academic_score,
                            test_score=test_score,
                            achievement_score=achievement_score,
                            essay_score=essay_score,
                            llm_score=llm_score,
                            llm_explanation=llm_explanation,
                            explanation=llm_explanation,
                            strengths=strengths,
                            areas_for_improvement=areas_for_improvement,
                            worker_attempts=1,  # Batch processing is single attempt
                            status=ApplicationStatusEnum.SCORED
                        )
                        self.app_repo.create_final_score(final_score)

                    # Update application status to SCORED
                    anon_app = self.app_repo.get_anonymized_by_id(anonymized_id)
                    if anon_app:
                        self.app_repo.update_status(
                            anon_app.application_id,
                            ApplicationStatusEnum.SCORED
                        )

                    imported_count += 1

                except json.JSONDecodeError as e:
                    logger.error(f"Line {line_num}: Invalid JSON - {e}")
                    failed_count += 1
                except Exception as e:
                    logger.error(f"Line {line_num}: Error importing result - {e}")
                    failed_count += 1

        # Update batch status
        self.batch_repo.complete_batch(
            batch_id,
            results_file_path,
            imported_count,
            failed_count
        )

        self.db.commit()

        logger.info(
            f"Import complete: {imported_count} successful, {failed_count} failed"
        )
        return imported_count

    def create_batch_run(
        self,
        cycle_id: str,
        batch_type: BatchTypeEnum,
        model_name: str,
        input_file_path: str,
        total_records: int,
        triggered_by: str
    ) -> int:
        """Create a new batch run record.

        Args:
            cycle_id: Admission cycle ID
            batch_type: Type of batch (worker or judge)
            model_name: LLM model name
            input_file_path: Path to input JSONL
            total_records: Total records in batch
            triggered_by: Admin ID

        Returns:
            int: Batch ID
        """
        batch = self.batch_repo.create_batch_run(
            admission_cycle_id=cycle_id,
            batch_type=batch_type,
            model_name=model_name,
            input_file_path=input_file_path,
            total_records=total_records,
            triggered_by=triggered_by
        )
        self.db.commit()
        return batch.batch_id

    def get_batch_status(self, batch_id: int) -> Optional[Dict[str, Any]]:
        """Get batch processing status.

        Args:
            batch_id: Batch ID

        Returns:
            Optional[Dict]: Batch status info or None
        """
        batch = self.batch_repo.get_batch_by_id(batch_id)
        if not batch:
            return None

        return {
            "batch_id": batch.batch_id,
            "cycle_id": batch.admission_cycle_id,
            "batch_type": batch.batch_type.value,
            "status": batch.status.value,
            "model_name": batch.model_name,
            "total_records": batch.total_records,
            "processed_records": batch.processed_records,
            "failed_records": batch.failed_records,
            "progress_percent": (
                batch.processed_records / batch.total_records * 100
                if batch.total_records > 0 else 0
            ),
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "error_log": batch.error_log
        }
