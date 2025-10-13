#!/usr/bin/env python3
"""
Application Submission Test Script

Tests the complete application submission flow to ensure all fixes work correctly.

Usage:
    python test_application_submission.py

Author: ENIGMA Development Team
"""

import sys
import traceback
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

def test_application_submission():
    """Test the complete application submission flow."""
    try:
        print("Testing Application Submission Flow")
        print("=" * 50)

        # Test 1: Import all required modules
        print("1. Testing imports...")
        try:
            from src.models.schemas import Application, ApplicationStatus
            from src.services.application_collector import ApplicationCollector
            from src.database.repositories import ApplicationRepository, AdminRepository
            from src.database.engine import get_db_context
            from src.utils.logger import get_logger, AuditLogger
            print("   All imports successful")
        except Exception as e:
            print(f"   Import error: {e}")
            return False

        # Test 2: Test database connection
        print("2. Testing database connection...")
        try:
            from src.database.engine import verify_connection
            if not verify_connection():
                print("   Database connection failed")
                return False
            print("   Database connection successful")
        except Exception as e:
            print(f"   Database connection error: {e}")
            return False

        # Test 3: Test active cycle exists
        print("3. Testing active admission cycle...")
        try:
            with get_db_context() as db:
                admin_repo = AdminRepository(db)
                active_cycle = admin_repo.get_active_cycle()

                if not active_cycle:
                    print("   No active admission cycle found")
                    print("   Create an admission cycle first")
                    return False

                print(f"   Active cycle found: {active_cycle.cycle_name}")
        except Exception as e:
            print(f"   Error checking active cycle: {e}")
            return False

        # Test 4: Test ApplicationCollector creation
        print("4. Testing ApplicationCollector...")
        try:
            with get_db_context() as db:
                audit_logger = AuditLogger(db)
                app_collector = ApplicationCollector(db, audit_logger)
                print("   ApplicationCollector created successfully")
        except Exception as e:
            print(f"   Error creating ApplicationCollector: {e}")
            return False

        # Test 5: Test application creation with sample data
        print("5. Testing application creation...")
        try:
            with get_db_context() as db:
                audit_logger = AuditLogger()
                app_collector = ApplicationCollector(db, audit_logger)

                # Sample application data
                sample_data = {
                    "name": "Test Student",
                    "email": "test@example.com",
                    "phone": "+1234567890",
                    "address": "123 Test St, Test City",
                    "gpa": 3.8,
                    "test_scores": {"SAT": 1450, "ACT": 32},
                    "essay": "This is a test essay about my academic journey and aspirations for the future. I have always been passionate about learning and growing as an individual.",
                    "achievements": "President of Science Club, Dean's List for 3 semesters, Volunteer at local library, Science fair winner"
                }

                # Create Pydantic model
                application = Application(**sample_data)

                # Test collection (this should work now)
                collected_app = app_collector.collect_application(sample_data)

                print(f"   Application collected: {collected_app.application_id}")
                print(f"   Application status: {collected_app.status}")

        except Exception as e:
            print(f"   Error creating application: {e}")
            traceback.print_exc()
            return False

        # Test 6: Test application retrieval
        print("6. Testing application retrieval...")
        try:
            with get_db_context() as db:
                app_repo = ApplicationRepository(db)
                # Get the application we just created
                retrieved_app = app_repo.get_by_application_id(collected_app.application_id)

                if retrieved_app:
                    print(f"   Application retrieved from DB: {retrieved_app.application_id}")
                    print(f"   Application name: {retrieved_app.name}")
                else:
                    print("   Application not found in database")
                    return False

        except Exception as e:
            print(f"   Error retrieving application: {e}")
            return False

        print("\nAll application submission tests passed!")
        print("\nSummary of fixes applied:")
        print("- Fixed ApplicationCollector to use create_application() method")
        print("- Fixed ApplicationCollector to use AdminRepository for active cycle")
        print("- Ensured proper separation between Pydantic and SQLAlchemy models")
        print("- Database initialization scripts created")

        return True

    except Exception as e:
        print(f"\nFatal error in test: {e}")
        traceback.print_exc()
        return False

def main():
    """Main function."""
    success = test_application_submission()
    print("\n" + "=" * 50)
    if success:
        print("Application submission is working correctly!")
        print("\nNext steps:")
        print("1. Start the backend server: python api.py")
        print("2. Test the API endpoints with curl or Postman")
        print("3. Create an admission cycle if needed")
    else:
        print("Application submission has issues that need to be fixed")
        print("\nSee error messages above for details")

    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
