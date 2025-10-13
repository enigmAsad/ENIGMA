#!/usr/bin/env python3
"""
Comprehensive Database Initialization Testing Script

This script performs robust testing of the ENIGMA database initialization
and provides detailed diagnostics for troubleshooting.

Usage:
    python database_init_test.py

Author: ENIGMA Development Team
"""

import os
import sys
import traceback
from pathlib import Path
from typing import Dict, Any, List, Tuple

from dotenv import load_dotenv

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

class DatabaseInitTester:
    """Comprehensive database initialization testing."""

    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self.env_loaded: bool = False
        self._load_env_file()

    def _load_env_file(self) -> None:
        """Load environment variables from .env file if present."""
        env_path = backend_dir / ".env"
        try:
            if env_path.exists():
                # Only load if not already loaded; override=False respects existing env vars
                self.env_loaded = load_dotenv(dotenv_path=env_path, override=False) or self.env_loaded
            else:
                self.env_loaded = False
        except Exception as e:
            # Record failure but continue so test_env_file can report detailed error
            self.log_test(
                "Environment Loader",
                False,
                f"Failed to load .env file: {e}",
                f"Path: {env_path}"
            )

    def log_test(self, test_name: str, success: bool, message: str, details: str = ""):
        """Log a test result."""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        }
        self.results.append(result)

        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}: {message}")
        if details:
            print(f"      Details: {details}")

        if not success:
            self.errors.append(f"{test_name}: {message}")

    def test_env_file(self) -> bool:
        """Test if .env file exists and is readable."""
        env_path = backend_dir / ".env"
        try:
            if not env_path.exists():
                return self.log_test(
                    "Environment File Check",
                    False,
                    ".env file not found",
                    f"Expected at: {env_path}"
                )

            # Check if file is readable
            with open(env_path, 'r') as f:
                content = f.read()

            if not content.strip():
                return self.log_test(
                    "Environment File Check",
                    False,
                    ".env file is empty",
                    "File exists but contains no content"
                )

            return self.log_test(
                "Environment File Check",
                True,
                ".env file exists and is readable",
                f"Size: {len(content)} characters"
            )

        except Exception as e:
            return self.log_test(
                "Environment File Check",
                False,
                f"Error reading .env file: {e}",
                f"Path: {env_path}"
            )

    def test_env_variables(self) -> bool:
        """Test if required environment variables are set."""
        required_vars = [
            'DATABASE_URL',
            'ENCRYPTION_KEY',
            'JWT_SECRET',
            'OPENAI_API_KEY'
        ]

        # Ensure .env file has been loaded before checking variables
        if not self.env_loaded:
            env_path = backend_dir / ".env"
            return self.log_test(
                "Environment Variables",
                False,
                "Environment variables not loaded",
                f".env file at {env_path} could not be loaded"
            )

        missing_vars = []
        invalid_vars = []

        for var in required_vars:
            value = os.getenv(var)
            if not value:
                missing_vars.append(var)
            elif not value.strip():
                invalid_vars.append(f"{var} (empty)")

        if missing_vars or invalid_vars:
            details = []
            if missing_vars:
                details.append(f"Missing: {', '.join(missing_vars)}")
            if invalid_vars:
                details.append(f"Empty: {', '.join(invalid_vars)}")

            return self.log_test(
                "Environment Variables",
                False,
                "Required environment variables not set",
                "; ".join(details)
            )

        return self.log_test(
            "Environment Variables",
            True,
            "All required environment variables are set",
            f"Found: {', '.join(required_vars)}"
        )

    def test_python_imports(self) -> bool:
        """Test if all Python modules can be imported successfully."""
        modules_to_test = [
            'src.config.settings',
            'src.database.engine',
            'src.database.models',
            'src.database.base',
            'src.database.repositories.application_repository',
            'src.database.repositories.admin_repository',
            'src.models.schemas',
            'src.services.application_collector'
        ]

        import_errors = []

        for module in modules_to_test:
            try:
                __import__(module)
            except Exception as e:
                import_errors.append(f"{module}: {e}")

        if import_errors:
            return self.log_test(
                "Python Module Imports",
                False,
                "Some modules failed to import",
                f"Errors: {'; '.join(import_errors)}"
            )

        return self.log_test(
            "Python Module Imports",
            True,
            "All required modules imported successfully",
            f"Tested {len(modules_to_test)} modules"
        )

    def test_database_connection(self) -> bool:
        """Test database connection."""
        try:
            from src.database.engine import verify_connection
            success = verify_connection()

            if success:
                return self.log_test(
                    "Database Connection",
                    True,
                    "Database connection successful"
                )
            else:
                return self.log_test(
                    "Database Connection",
                    False,
                    "Database connection failed",
                    "verify_connection() returned False"
                )

        except Exception as e:
            return self.log_test(
                "Database Connection",
                False,
                f"Database connection error: {e}",
                "Check DATABASE_URL and network connectivity"
            )

    def test_table_existence(self) -> bool:
        """Test if database tables exist."""
        table_names = [
            'applications',
            'anonymized_applications',
            'identity_mapping',
            'deterministic_metrics',
            'batch_runs',
            'worker_results',
            'judge_results',
            'final_scores',
            'admin_users',
            'admin_sessions',
            'admission_cycles',
            'selection_logs',
            'hash_chain',
            'audit_logs'
        ]

        existing_tables = []
        missing_tables = []

        try:
            from src.database.engine import get_db_context
            from sqlalchemy import text

            with get_db_context() as db:
                # Query for existing tables
                result = db.execute(text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                """))

                existing_tables = [row[0] for row in result.fetchall()]

                # Check our required tables
                for table in table_names:
                    if table in existing_tables:
                        existing_tables.remove(table)  # Remove from existing to avoid double-counting
                    else:
                        missing_tables.append(table)

                if missing_tables:
                    return self.log_test(
                        "Database Tables",
                        False,
                        f"Missing required tables: {', '.join(missing_tables)}",
                        f"Found {len(existing_tables)} existing tables"
                    )

                return self.log_test(
                    "Database Tables",
                    True,
                    f"All {len(table_names)} required tables exist",
                    f"Total tables in DB: {len(existing_tables) + len(table_names)}"
                )

        except Exception as e:
            return self.log_test(
                "Database Tables",
                False,
                f"Error checking table existence: {e}",
                "Database connection may be required"
            )

    def test_model_registration(self) -> bool:
        """Test if SQLAlchemy models are properly registered."""
        try:
            from src.database.models import (
                Application, AdminUser, AdmissionCycle,
                AnonymizedApplication, BatchRun
            )

            # Check if models have __table__ attribute (indicates SQLAlchemy mapping)
            models_to_check = [
                ('Application', Application),
                ('AdminUser', AdminUser),
                ('AdmissionCycle', AdmissionCycle),
                ('AnonymizedApplication', AnonymizedApplication),
                ('BatchRun', BatchRun)
            ]

            unregistered_models = []

            for name, model in models_to_check:
                if not hasattr(model, '__table__'):
                    unregistered_models.append(name)

            if unregistered_models:
                return self.log_test(
                    "Model Registration",
                    False,
                    f"Unregistered models: {', '.join(unregistered_models)}",
                    "Models don't have __table__ attribute"
                )

            return self.log_test(
                "Model Registration",
                True,
                f"All {len(models_to_check)} models are properly registered",
                "Models have __table__ attribute indicating SQLAlchemy mapping"
            )

        except Exception as e:
            return self.log_test(
                "Model Registration",
                False,
                f"Error testing model registration: {e}",
                "Import or attribute error"
            )

    def test_active_cycle(self) -> bool:
        """Test if there's an active admission cycle."""
        try:
            from src.database.engine import get_db_context
            from src.database.repositories import AdminRepository

            with get_db_context() as db:
                admin_repo = AdminRepository(db)
                active_cycle = admin_repo.get_active_cycle()

                if active_cycle:
                    return self.log_test(
                        "Active Admission Cycle",
                        True,
                        f"Active cycle found: {active_cycle.cycle_name}",
                        f"Phase: {active_cycle.phase}, Seats: {active_cycle.current_seats}/{active_cycle.max_seats}"
                    )
                else:
                    return self.log_test(
                        "Active Admission Cycle",
                        False,
                        "No active admission cycle found",
                        "Need to create an admission cycle before accepting applications"
                    )

        except Exception as e:
            return self.log_test(
                "Active Admission Cycle",
                False,
                f"Error checking active cycle: {e}",
                "Database or repository error"
            )

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all database initialization tests."""
        print("🔍 ENIGMA Database Initialization Test Suite")
        print("=" * 50)

        # Run all tests
        self.test_env_file()
        self.test_env_variables()
        self.test_python_imports()
        self.test_database_connection()
        self.test_model_registration()

        # Only test tables and active cycle if connection works
        if any(r['test'] == 'Database Connection' and r['success'] for r in self.results):
            self.test_table_existence()
            self.test_active_cycle()

        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests

        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")

        if failed_tests == 0:
            print("\n🎉 All tests passed! Database is properly initialized.")
        else:
            print(f"\n⚠️  {failed_tests} tests failed. See details above.")
            print("\n🔧 COMMON FIXES:")
            print("1. Create .env file with required variables")
            print("2. Run database initialization: python -c 'from src.database.engine import init_db; init_db()'")
            print("3. Create an admission cycle through admin interface")

        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "results": self.results,
            "errors": self.errors
        }


def main():
    """Main function to run the test suite."""
    tester = DatabaseInitTester()
    return tester.run_all_tests()


if __name__ == "__main__":
    try:
        result = main()
        sys.exit(0 if result['failed_tests'] == 0 else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️  Test suite interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Fatal error in test suite: {e}")
        traceback.print_exc()
        sys.exit(1)
