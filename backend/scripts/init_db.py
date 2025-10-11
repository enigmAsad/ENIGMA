#!/usr/bin/env python
"""Initialize the database with all tables and create first admin user.

This script:
1. Verifies database connection
2. Runs Alembic migrations to create all tables
3. Optionally creates the first admin user

Usage:
    python scripts/init_db.py
    python scripts/init_db.py --skip-migrations  # Only create admin
    python scripts/init_db.py --skip-admin      # Only run migrations
"""

import sys
import argparse
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from alembic import command
from alembic.config import Config
from src.database.engine import verify_connection
from src.utils.logger import get_logger
from scripts.create_admin import create_admin_user
from getpass import getpass

logger = get_logger("init_db")


def run_migrations():
    """Run Alembic migrations to create/update database schema."""
    print("Running database migrations...")

    try:
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("✅ Migrations completed successfully")
        return True
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"❌ Migration failed: {e}")
        return False


def main():
    """Main initialization function."""
    parser = argparse.ArgumentParser(
        description="Initialize ENIGMA database"
    )
    parser.add_argument(
        "--skip-migrations",
        action="store_true",
        help="Skip running migrations (use if tables already exist)"
    )
    parser.add_argument(
        "--skip-admin",
        action="store_true",
        help="Skip creating admin user"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("ENIGMA Backend - Database Initialization")
    print("=" * 70)
    print()

    # Step 1: Verify database connection
    print("Step 1: Verifying database connection...")
    if not verify_connection():
        print("❌ Database connection failed")
        print("   Check your DATABASE_URL in .env file")
        return 1
    print("✅ Database connection successful")
    print()

    # Step 2: Run migrations
    if not args.skip_migrations:
        print("Step 2: Running database migrations...")
        if not run_migrations():
            return 1
        print()
    else:
        print("Step 2: Skipping migrations (--skip-migrations)")
        print()

    # Step 3: Create admin user
    if not args.skip_admin:
        print("Step 3: Creating first admin user...")
        print()

        username = input("Enter admin username (default: admin): ").strip() or "admin"
        email = input("Enter admin email: ").strip()

        if not email or "@" not in email:
            print("❌ Valid email is required")
            return 1

        password = getpass("Enter admin password: ")
        password_confirm = getpass("Confirm password: ")

        if password != password_confirm:
            print("❌ Passwords do not match")
            return 1

        if len(password) < 8:
            print("❌ Password must be at least 8 characters")
            return 1

        role = input("Enter role (admin/super_admin/auditor, default: super_admin): ").strip() or "super_admin"

        if create_admin_user(username, email, password, role):
            print("✅ Admin user created successfully")
        else:
            print("⚠️  Admin user creation failed (may already exist)")
        print()
    else:
        print("Step 3: Skipping admin creation (--skip-admin)")
        print()

    print("=" * 70)
    print("✅ Database initialization complete!")
    print()
    print("Next steps:")
    print("  1. Start the API server: uvicorn api:app --reload")
    print("  2. Log in with your admin credentials")
    print("  3. Create an admission cycle")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
