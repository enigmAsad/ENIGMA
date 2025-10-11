"""CSV handler with atomic writes for ENIGMA Phase 1."""

import csv
import json
import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Type, TypeVar
from datetime import datetime
from threading import Lock

from pydantic import BaseModel

from src.config.settings import get_settings
from src.models.schemas import (
    Application,
    AnonymizedApplication,
    WorkerResult,
    JudgeResult,
    FinalScore,
    AuditLog,
    HashChainEntry,
)
from src.utils.logger import get_logger


T = TypeVar('T', bound=BaseModel)

logger = get_logger("csv_handler")


class CSVHandler:
    """Thread-safe CSV handler with atomic writes."""

    # CSV file names
    APPLICATIONS_CSV = "applications.csv"
    ANONYMIZED_CSV = "anonymized.csv"
    IDENTITY_MAPPING_CSV = "identity_mapping.csv"
    WORKER_RESULTS_CSV = "phase1_worker_results.csv"
    JUDGE_RESULTS_CSV = "phase1_judge_results.csv"
    FINAL_SCORES_CSV = "phase1_final_scores.csv"
    AUDIT_LOG_CSV = "audit_log.csv"
    HASH_CHAIN_CSV = "hash_chain.csv"

    def __init__(self):
        """Initialize CSV handler."""
        self.settings = get_settings()
        self.data_dir = self.settings.data_dir
        self._locks: Dict[str, Lock] = {}
        self._ensure_csv_files_exist()

    def _get_lock(self, csv_name: str) -> Lock:
        """Get or create a lock for a specific CSV file.

        Args:
            csv_name: Name of the CSV file

        Returns:
            Lock: Thread lock for the file
        """
        if csv_name not in self._locks:
            self._locks[csv_name] = Lock()
        return self._locks[csv_name]

    def _get_csv_path(self, csv_name: str) -> Path:
        """Get full path for CSV file.

        Args:
            csv_name: Name of the CSV file

        Returns:
            Path: Full path to the CSV file
        """
        return self.data_dir / csv_name

    def _ensure_csv_files_exist(self):
        """Ensure all CSV files exist with headers."""
        csv_schemas = {
            self.APPLICATIONS_CSV: [
                "application_id", "timestamp", "name", "email", "phone", "address",
                "gpa", "test_scores_json", "essay", "achievements", "status"
            ],
            self.ANONYMIZED_CSV: [
                "anonymized_id", "application_id", "gpa", "test_scores_json",
                "essay_scrubbed", "achievements_scrubbed", "created_at"
            ],
            self.IDENTITY_MAPPING_CSV: [
                "anonymized_id", "application_id", "encrypted_pii", "created_at"
            ],
            self.WORKER_RESULTS_CSV: [
                "result_id", "anonymized_id", "attempt_number", "academic_score",
                "test_score", "achievement_score", "essay_score", "total_score",
                "explanation", "reasoning_json", "rubric_adherence", "timestamp", "model_used"
            ],
            self.JUDGE_RESULTS_CSV: [
                "judge_id", "result_id", "anonymized_id", "worker_result_id",
                "decision", "bias_detected", "quality_score", "feedback", "reasoning",
                "timestamp", "model_used"
            ],
            self.FINAL_SCORES_CSV: [
                "anonymized_id", "final_score", "academic_score", "test_score",
                "achievement_score", "essay_score", "explanation", "strengths_json",
                "areas_for_improvement_json", "timestamp", "hash", "worker_attempts"
            ],
            self.AUDIT_LOG_CSV: [
                "log_id", "timestamp", "entity_type", "entity_id", "action", "actor",
                "details_json", "metadata_json", "previous_hash", "current_hash"
            ],
            self.HASH_CHAIN_CSV: [
                "chain_id", "anonymized_id", "decision_type", "data_json",
                "data_hash", "previous_hash", "timestamp"
            ],
        }

        for csv_name, headers in csv_schemas.items():
            csv_path = self._get_csv_path(csv_name)
            if not csv_path.exists():
                with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(headers)
                logger.info(f"Created CSV file: {csv_path}")

    def _atomic_write(self, csv_path: Path, rows: List[List[str]], mode: str = 'w'):
        """Atomically write to CSV file.

        Uses temporary file and atomic rename to ensure consistency.

        Args:
            csv_path: Path to the CSV file
            rows: List of rows to write
            mode: Write mode ('w' for overwrite, 'a' for append)
        """
        # Create temporary file in the same directory for atomic rename
        temp_fd, temp_path = tempfile.mkstemp(
            dir=csv_path.parent,
            prefix=f".tmp_{csv_path.name}_",
            suffix='.csv'
        )

        try:
            with os.fdopen(temp_fd, 'w', newline='', encoding='utf-8') as temp_file:
                writer = csv.writer(temp_file)

                if mode == 'a' and csv_path.exists():
                    # For append mode, read existing content
                    with open(csv_path, 'r', encoding='utf-8') as existing_file:
                        reader = csv.reader(existing_file)
                        for row in reader:
                            writer.writerow(row)

                # Write new rows
                writer.writerows(rows)

                # Ensure data is written to disk
                temp_file.flush()
                os.fsync(temp_file.fileno())

            # Atomic rename (POSIX) or replace (Windows)
            if os.name == 'nt':  # Windows
                # On Windows, need to remove target file first
                if csv_path.exists():
                    backup_path = csv_path.with_suffix('.bak')
                    shutil.copy2(csv_path, backup_path)
                    os.replace(temp_path, csv_path)
                    backup_path.unlink()  # Remove backup after successful write
                else:
                    os.replace(temp_path, csv_path)
            else:  # Unix/Linux/macOS
                os.replace(temp_path, csv_path)

        except Exception as e:
            # Clean up temporary file on error
            if Path(temp_path).exists():
                Path(temp_path).unlink()
            raise e

    def _model_to_csv_row(self, model: BaseModel) -> List[str]:
        """Convert Pydantic model to CSV row.

        Args:
            model: Pydantic model instance

        Returns:
            List[str]: CSV row values
        """
        data = model.model_dump()

        # Convert complex types to JSON strings
        for key, value in data.items():
            if isinstance(value, dict) or isinstance(value, list):
                data[key] = json.dumps(value)
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
            elif value is None:
                data[key] = ""
            else:
                data[key] = str(value)

        return list(data.values())

    def _read_csv(self, csv_name: str) -> List[Dict[str, str]]:
        """Read CSV file as list of dictionaries.

        Args:
            csv_name: Name of the CSV file

        Returns:
            List[Dict[str, str]]: List of rows as dictionaries
        """
        csv_path = self._get_csv_path(csv_name)

        if not csv_path.exists():
            return []

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)

    def append_application(self, application: Application):
        """Append application to CSV.

        Args:
            application: Application model
        """
        lock = self._get_lock(self.APPLICATIONS_CSV)
        with lock:
            csv_path = self._get_csv_path(self.APPLICATIONS_CSV)
            row = self._model_to_csv_row(application)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended application: {application.application_id}")

    def append_anonymized_application(self, anonymized: AnonymizedApplication):
        """Append anonymized application to CSV.

        Args:
            anonymized: AnonymizedApplication model
        """
        lock = self._get_lock(self.ANONYMIZED_CSV)
        with lock:
            csv_path = self._get_csv_path(self.ANONYMIZED_CSV)
            row = self._model_to_csv_row(anonymized)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended anonymized application: {anonymized.anonymized_id}")

    def append_worker_result(self, worker_result: WorkerResult):
        """Append worker result to CSV.

        Args:
            worker_result: WorkerResult model
        """
        lock = self._get_lock(self.WORKER_RESULTS_CSV)
        with lock:
            csv_path = self._get_csv_path(self.WORKER_RESULTS_CSV)
            row = self._model_to_csv_row(worker_result)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended worker result: {worker_result.result_id}")

    def append_judge_result(self, judge_result: JudgeResult):
        """Append judge result to CSV.

        Args:
            judge_result: JudgeResult model
        """
        lock = self._get_lock(self.JUDGE_RESULTS_CSV)
        with lock:
            csv_path = self._get_csv_path(self.JUDGE_RESULTS_CSV)
            row = self._model_to_csv_row(judge_result)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended judge result: {judge_result.judge_id}")

    def append_final_score(self, final_score: FinalScore):
        """Append final score to CSV.

        Args:
            final_score: FinalScore model
        """
        lock = self._get_lock(self.FINAL_SCORES_CSV)
        with lock:
            csv_path = self._get_csv_path(self.FINAL_SCORES_CSV)
            row = self._model_to_csv_row(final_score)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended final score: {final_score.anonymized_id}")

    def append_audit_log(self, audit_log: AuditLog):
        """Append audit log entry to CSV.

        Args:
            audit_log: AuditLog model
        """
        lock = self._get_lock(self.AUDIT_LOG_CSV)
        with lock:
            csv_path = self._get_csv_path(self.AUDIT_LOG_CSV)
            row = self._model_to_csv_row(audit_log)
            self._atomic_write(csv_path, [row], mode='a')

    def append_hash_chain_entry(self, hash_entry: HashChainEntry):
        """Append hash chain entry to CSV.

        Args:
            hash_entry: HashChainEntry model
        """
        lock = self._get_lock(self.HASH_CHAIN_CSV)
        with lock:
            csv_path = self._get_csv_path(self.HASH_CHAIN_CSV)
            row = self._model_to_csv_row(hash_entry)
            self._atomic_write(csv_path, [row], mode='a')
        logger.debug(f"Appended hash chain entry: {hash_entry.chain_id}")

    def get_application_by_id(self, application_id: str) -> Optional[Application]:
        """Get application by ID.

        Args:
            application_id: Application ID

        Returns:
            Optional[Application]: Application if found, None otherwise
        """
        rows = self._read_csv(self.APPLICATIONS_CSV)
        for row in rows:
            if row['application_id'] == application_id:
                # Parse JSON fields
                row['test_scores_json'] = json.loads(row.get('test_scores_json', '{}'))
                return Application(**row)
        return None

    def get_anonymized_by_id(self, anonymized_id: str) -> Optional[AnonymizedApplication]:
        """Get anonymized application by ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[AnonymizedApplication]: Anonymized application if found
        """
        rows = self._read_csv(self.ANONYMIZED_CSV)
        for row in rows:
            if row['anonymized_id'] == anonymized_id:
                row['test_scores_json'] = json.loads(row.get('test_scores_json', '{}'))
                return AnonymizedApplication(**row)
        return None

    def get_worker_results_by_anonymized_id(self, anonymized_id: str) -> List[WorkerResult]:
        """Get all worker results for an anonymized application.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            List[WorkerResult]: List of worker results
        """
        rows = self._read_csv(self.WORKER_RESULTS_CSV)
        results = []
        for row in rows:
            if row['anonymized_id'] == anonymized_id:
                row['reasoning_json'] = json.loads(row.get('reasoning_json', '{}'))
                row['attempt_number'] = int(row['attempt_number'])
                results.append(WorkerResult(**row))
        return results

    def get_latest_worker_result(self, anonymized_id: str) -> Optional[WorkerResult]:
        """Get latest worker result for an anonymized application.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[WorkerResult]: Latest worker result if found
        """
        results = self.get_worker_results_by_anonymized_id(anonymized_id)
        if not results:
            return None
        return max(results, key=lambda r: r.attempt_number)

    def get_judge_result_by_worker_id(self, worker_result_id: str) -> Optional[JudgeResult]:
        """Get judge result for a worker result.

        Args:
            worker_result_id: Worker result ID

        Returns:
            Optional[JudgeResult]: Judge result if found
        """
        rows = self._read_csv(self.JUDGE_RESULTS_CSV)
        for row in rows:
            if row['worker_result_id'] == worker_result_id:
                row['bias_detected'] = row['bias_detected'].lower() == 'true'
                row['quality_score'] = float(row['quality_score'])
                return JudgeResult(**row)
        return None

    def get_final_score_by_id(self, anonymized_id: str) -> Optional[FinalScore]:
        """Get final score by anonymized ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[FinalScore]: Final score if found
        """
        rows = self._read_csv(self.FINAL_SCORES_CSV)
        for row in rows:
            if row['anonymized_id'] == anonymized_id:
                row['strengths_json'] = json.loads(row.get('strengths_json', '[]'))
                row['areas_for_improvement_json'] = json.loads(row.get('areas_for_improvement_json', '[]'))
                row['worker_attempts'] = int(row['worker_attempts'])
                return FinalScore(**row)
        return None

    def get_hash_chain(self) -> List[HashChainEntry]:
        """Get entire hash chain.

        Returns:
            List[HashChainEntry]: Complete hash chain ordered by timestamp
        """
        rows = self._read_csv(self.HASH_CHAIN_CSV)
        entries = []
        for row in rows:
            entries.append(HashChainEntry(**row))
        return sorted(entries, key=lambda e: e.timestamp)

    def get_all_final_scores(self) -> List[FinalScore]:
        """Get all final scores.

        Returns:
            List[FinalScore]: All final scores
        """
        rows = self._read_csv(self.FINAL_SCORES_CSV)
        scores = []
        for row in rows:
            row['strengths_json'] = json.loads(row.get('strengths_json', '[]'))
            row['areas_for_improvement_json'] = json.loads(row.get('areas_for_improvement_json', '[]'))
            row['worker_attempts'] = int(row['worker_attempts'])
            scores.append(FinalScore(**row))
        return scores
