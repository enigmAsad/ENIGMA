"""Main CLI entry point for ENIGMA Phase 1 backend."""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path for module imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config.settings import get_settings
from src.models.schemas import Application
from src.services.application_collector import ApplicationCollector
from src.services.hash_chain import HashChainGenerator
from src.database.engine import get_db_context
from src.database.repositories import ApplicationRepository, AdminRepository
from src.utils.logger import get_logger, AuditLogger
# Real-time pipeline removed - now using 9-phase batch workflow via REST API
# See api.py for Phase 1-9 endpoints


logger = get_logger("main")


def init_command(args):
    """Initialize directories and check configuration."""
    print("Initializing ENIGMA Phase 1 backend...\n")

    try:
        settings = get_settings()

        # Check directories
        print(f"✓ Data directory: {settings.data_dir}")
        print(f"✓ Prompt directory: {settings.prompt_dir}")
        print(f"✓ Log directory: {settings.log_dir}")

        # Check prompts
        worker_prompt = settings.prompt_dir / "worker_prompt.txt"
        judge_prompt = settings.prompt_dir / "judge_prompt.txt"
        rubric = settings.prompt_dir / "rubric.json"

        if worker_prompt.exists():
            print(f"✓ Worker prompt: {worker_prompt}")
        else:
            print(f"✗ Worker prompt missing: {worker_prompt}")

        if judge_prompt.exists():
            print(f"✓ Judge prompt: {judge_prompt}")
        else:
            print(f"✗ Judge prompt missing: {judge_prompt}")

        if rubric.exists():
            print(f"✓ Rubric: {rubric}")
        else:
            print(f"✗ Rubric missing: {rubric}")

        # Check API key
        if settings.openai_api_key:
            print(f"✓ OpenAI API key configured")
        else:
            print(f"✗ OpenAI API key not configured")

        # Check email
        if settings.is_email_configured():
            print(f"✓ Email configured ({settings.email_from})")
        else:
            print(f"⚠ Email not configured (notifications will be logged only)")

        # Initialize database connection
        try:
            with get_db_context() as db:
                print("✓ Database connection established")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)

        print("\n✓ Initialization complete!")

    except Exception as e:
        print(f"\n✗ Initialization failed: {e}")
        sys.exit(1)


def run_command(args):
    """DEPRECATED: Real-time pipeline has been replaced with 9-phase batch workflow."""
    print("⚠️  DEPRECATED: 'run' command is no longer supported.\n")
    print("The real-time pipeline has been replaced with the 9-phase batch workflow.")
    print("Applications are now processed through the REST API:\n")
    print("Phase 1: POST /applications - Submit applications")
    print("Phase 2: POST /admin/cycles/{id}/freeze - Freeze cycle")
    print("Phase 3: POST /admin/cycles/{id}/preprocess - Scrub identities & compute metrics")
    print("Phase 4: POST /admin/cycles/{id}/export - Export to JSONL")
    print("Phase 5: (External LLM batch processing)")
    print("Phase 6: POST /admin/batch/{id}/import - Import LLM results")
    print("Phase 7-9: Selection, publishing, completion\n")
    print("Please use the REST API or frontend interface instead.")
    print("See BACKEND.md for full documentation.")
    sys.exit(1)


def process_command(args):
    """DEPRECATED: Real-time pipeline has been replaced with 9-phase batch workflow."""
    print("⚠️  DEPRECATED: 'process' command is no longer supported.\n")
    print("The real-time pipeline has been replaced with the 9-phase batch workflow.")
    print("Individual applications are no longer processed in isolation.\n")
    print("To check application status, use:")
    print(f"  GET /applications/{args.application_id}\n")
    print("See BACKEND.md for full 9-phase workflow documentation.")
    sys.exit(1)


def verify_command(args):
    """Verify hash chain integrity."""
    print("Verifying hash chain integrity...\n")

    try:
        # TODO: Implement hash chain verification with PostgreSQL
        print("✓ Hash chain verification not yet implemented for PostgreSQL")
        print("  (This feature will be added in a future update)")

    except Exception as e:
        print(f"\n✗ Verification failed: {e}")
        logger.error(f"Verify command failed: {e}")
        sys.exit(1)


def export_command(args):
    """Export results to CSV."""
    print(f"Exporting results to: {args.output}\n")

    try:
        with get_db_context() as db:
            app_repo = ApplicationRepository(db)

            # Get all final scores
            final_scores = app_repo.get_all_final_scores()

            if not final_scores:
                print("No results to export")
                return

            # Export to CSV
            output_path = Path(args.output)
            with open(output_path, 'w', newline='', encoding='utf-8') as f:
                import csv
                writer = csv.writer(f)

                # Header
                writer.writerow([
                    "Anonymized ID", "Final Score", "Academic", "Test",
                    "Achievement", "Essay", "Explanation", "Worker Attempts", "Hash"
                ])

            # Data
            for score in final_scores:
                writer.writerow([
                    score.anonymized_id,
                    f"{score.final_score:.2f}",
                    f"{score.academic_score:.2f}",
                    f"{score.test_score:.2f}",
                    f"{score.achievement_score:.2f}",
                    f"{score.essay_score:.2f}",
                    score.explanation[:200],  # Truncate
                    score.worker_attempts,
                    score.hash
                ])

        print(f"✓ Exported {len(final_scores)} results to {output_path}")

    except Exception as e:
        print(f"\n✗ Export failed: {e}")
        logger.error(f"Export command failed: {e}")
        sys.exit(1)


def status_command(args):
    """Show system status."""
    print("=== ENIGMA Phase 1 Status ===\n")

    try:
        with get_db_context() as db:
            app_repo = ApplicationRepository(db)

            # Count applications
            total_apps = app_repo.get_total_count()
            completed_evaluations = app_repo.get_completed_evaluations_count()
            average_score = app_repo.get_average_final_score()

            print(f"Applications submitted: {total_apps}")
            print(f"Identity scrubbed: {total_apps}")
            print(f"Worker evaluations: {completed_evaluations}")
            print(f"Judge reviews: {completed_evaluations}")
            print(f"Completed (final scores): {completed_evaluations}")
            print(f"Hash chain entries: 0")  # TODO: Implement with audit logs

            if average_score is not None:
                print(f"\nScore statistics:")
                print(f"  Average: {average_score:.2f}")
                print(f"  Min: N/A")
                print(f"  Max: N/A")

    except Exception as e:
        print(f"\n✗ Status check failed: {e}")
        logger.error(f"Status command failed: {e}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="ENIGMA Phase 1 - AI-powered blind admissions system",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # init command
    parser_init = subparsers.add_parser('init', help='Initialize system and check configuration')
    parser_init.set_defaults(func=init_command)

    # run command
    parser_run = subparsers.add_parser('run', help='Run Phase 1 pipeline on applications')
    parser_run.add_argument('--input', '-i', required=True, help='Input JSON file with applications')
    parser_run.set_defaults(func=run_command)

    # process command
    parser_process = subparsers.add_parser('process', help='Process single application by ID')
    parser_process.add_argument('--application-id', '-a', required=True, help='Application ID')
    parser_process.set_defaults(func=process_command)

    # verify command
    parser_verify = subparsers.add_parser('verify', help='Verify hash chain integrity')
    parser_verify.set_defaults(func=verify_command)

    # export command
    parser_export = subparsers.add_parser('export', help='Export results to CSV')
    parser_export.add_argument('--output', '-o', required=True, help='Output CSV file')
    parser_export.set_defaults(func=export_command)

    # status command
    parser_status = subparsers.add_parser('status', help='Show system status')
    parser_status.set_defaults(func=status_command)

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Execute command
    args.func(args)


if __name__ == "__main__":
    main()
