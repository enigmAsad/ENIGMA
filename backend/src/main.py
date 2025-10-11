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
from src.orchestration.phase1_pipeline import run_pipeline


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
    """Run Phase 1 pipeline on applications."""
    print(f"Running Phase 1 pipeline on: {args.input}\n")

    try:
        # Load applications
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"✗ Input file not found: {input_path}")
            sys.exit(1)

        with open(input_path, 'r', encoding='utf-8') as f:
            applications_data = json.load(f)

        if not isinstance(applications_data, list):
            applications_data = [applications_data]

        print(f"Loaded {len(applications_data)} application(s)")

        # Initialize services
        with get_db_context() as db:
            audit_logger = AuditLogger()
            app_collector = ApplicationCollector(
                db=db,
                audit_logger=audit_logger
            )

        # Collect applications
        print("\n=== Collecting Applications ===")
        applications = []
        for i, app_data in enumerate(applications_data):
            try:
                application = app_collector.collect_application(app_data)
                applications.append(application)
                print(f"  {i+1}. Collected: {application.application_id}")
            except Exception as e:
                print(f"  {i+1}. Failed: {e}")

        # Run pipeline for each application
        print(f"\n=== Running Pipeline for {len(applications)} Application(s) ===\n")
        results = []
        for i, application in enumerate(applications):
            print(f"[{i+1}/{len(applications)}] Processing {application.application_id}...")
            try:
                final_state = run_pipeline(application)
                results.append(final_state)

                if final_state.status.value == "completed":
                    print(f"  ✓ Complete: Score {final_state.final_score.final_score:.2f}/100\n")
                else:
                    print(f"  ✗ Failed: {final_state.error}\n")

            except Exception as e:
                print(f"  ✗ Pipeline error: {e}\n")
                logger.error(f"Pipeline failed for {application.application_id}: {e}")

        # Summary
        completed = sum(1 for r in results if r.status.value == "completed")
        failed = len(results) - completed

        print("=== Summary ===")
        print(f"Total: {len(results)}")
        print(f"Completed: {completed}")
        print(f"Failed: {failed}")

        if completed > 0:
            avg_score = sum(r.final_score.final_score for r in results if r.final_score) / completed
            print(f"Average Score: {avg_score:.2f}/100")

    except Exception as e:
        print(f"\n✗ Run failed: {e}")
        logger.error(f"Run command failed: {e}")
        sys.exit(1)


def process_command(args):
    """Process a single application by ID."""
    print(f"Processing application: {args.application_id}\n")

    try:
        with get_db_context() as db:
            app_repo = ApplicationRepository(db)

            # Get application
            application = app_repo.get_by_application_id(args.application_id)
            if not application:
                print(f"✗ Application not found: {args.application_id}")
                sys.exit(1)

        print(f"Found application: {application.name} ({application.email})")

        # Run pipeline
        print("\nRunning pipeline...\n")
        final_state = run_pipeline(application)

        if final_state.status.value == "completed":
            print(f"\n✓ Pipeline complete!")
            print(f"Anonymized ID: {final_state.anonymized_id}")
            print(f"Final Score: {final_state.final_score.final_score:.2f}/100")
            print(f"Worker Attempts: {final_state.worker_attempt}")
            print(f"Hash: {final_state.hash}")
        else:
            print(f"\n✗ Pipeline failed: {final_state.error}")
            sys.exit(1)

    except Exception as e:
        print(f"\n✗ Process failed: {e}")
        logger.error(f"Process command failed: {e}")
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
