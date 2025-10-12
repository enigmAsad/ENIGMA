#!/usr/bin/env python3
"""
Database Initialization Script

Safely initializes the ENIGMA database with all required tables.
This script includes proper error handling and rollback capabilities.

Usage:
    python init_database.py

Author: ENIGMA Development Team
"""

import sys
import traceback
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

def init_database():
    """Initialize database with all tables."""
    try:
        print("🔄 Initializing ENIGMA database...")

        # Import database engine
        from src.database.engine import init_db, verify_connection

        # Test connection first
        print("1. Testing database connection...")
        if not verify_connection():
            raise Exception("Cannot connect to database. Check your DATABASE_URL in .env file")

        print("✅ Database connection successful")

        # Initialize tables
        print("2. Creating database tables...")
        init_db()
        print("✅ Database tables created successfully")

        # Verify tables exist
        print("3. Verifying table creation...")
        if not verify_connection():
            raise Exception("Database connection lost after table creation")

        print("✅ Table creation verified")

        print("\n🎉 Database initialization completed successfully!")
        print("\nNext steps:")
        print("1. Create an admin user: python scripts/create_admin.py")
        print("2. Create an admission cycle (through admin interface)")
        print("3. Test application submission")

        return True

    except Exception as e:
        print(f"\n❌ Database initialization failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("1. Check your .env file exists and has correct DATABASE_URL")
        print("2. Verify the database server is running and accessible")
        print("3. Check database permissions")
        print("4. Run the test script: python src/testing/database_init_test.py")

        if "--verbose" in sys.argv:
            traceback.print_exc()

        return False

def main():
    """Main function."""
    success = init_database()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
