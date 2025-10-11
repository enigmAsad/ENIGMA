#!/usr/bin/env python
"""Create an admin user in the database.

This script creates the first admin user for the ENIGMA system.
It should be run after the database has been initialized with Alembic.

Usage:
    python scripts/create_admin.py

    # Or with arguments
    python scripts/create_admin.py --username admin --email admin@example.com --role super_admin
"""

import sys
import argparse
from pathlib import Path
from getpass import getpass

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import bcrypt
from sqlalchemy.exc import IntegrityError

from src.database.engine import get_db_context
from src.database.models import AdminUser, AdminRoleEnum
from src.utils.logger import get_logger

logger = get_logger("create_admin")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        str: Bcrypt hashed password
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_admin_user(
    username: str,
    email: str,
    password: str,
    role: str = "admin"
) -> bool:
    """Create an admin user in the database.

    Args:
        username: Admin username
        email: Admin email
        password: Plain text password (will be hashed)
        role: Admin role (admin, super_admin, auditor)

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Validate role
        role_enum = AdminRoleEnum[role.upper()]

        # Hash password
        password_hash = hash_password(password)

        # Create admin user
        admin_id = f"ADM_{username.upper()[:8]}"

        admin = AdminUser(
            admin_id=admin_id,
            username=username,
            password_hash=password_hash,
            email=email,
            role=role_enum,
            is_active=True
        )

        with get_db_context() as db:
            db.add(admin)
            db.commit()

        logger.info(f"Admin user created successfully: {username}")
        return True

    except IntegrityError as e:
        logger.error(f"Admin user already exists: {e}")
        return False
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")
        return False


def main():
    """Main function with CLI interface."""
    parser = argparse.ArgumentParser(
        description="Create an admin user for ENIGMA backend"
    )
    parser.add_argument(
        "--username",
        type=str,
        help="Admin username (default: prompted)"
    )
    parser.add_argument(
        "--email",
        type=str,
        help="Admin email (default: prompted)"
    )
    parser.add_argument(
        "--password",
        type=str,
        help="Admin password (default: prompted, recommended for security)"
    )
    parser.add_argument(
        "--role",
        type=str,
        choices=["admin", "super_admin", "auditor"],
        default="admin",
        help="Admin role (default: admin)"
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run in non-interactive mode (requires all args)"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("ENIGMA Backend - Admin User Creation")
    print("=" * 70)
    print()

    # Get username
    if args.username:
        username = args.username
    else:
        username = input("Enter admin username: ").strip()
        if not username:
            print("❌ Username is required")
            return 1

    # Get email
    if args.email:
        email = args.email
    else:
        email = input("Enter admin email: ").strip()
        if not email or "@" not in email:
            print("❌ Valid email is required")
            return 1

    # Get password
    if args.password:
        password = args.password
        print("⚠️  WARNING: Passing password via command line is insecure!")
    else:
        password = getpass("Enter admin password: ")
        password_confirm = getpass("Confirm password: ")

        if password != password_confirm:
            print("❌ Passwords do not match")
            return 1

        if len(password) < 8:
            print("❌ Password must be at least 8 characters")
            return 1

    role = args.role

    print()
    print("Creating admin user with:")
    print(f"  Username: {username}")
    print(f"  Email:    {email}")
    print(f"  Role:     {role}")
    print()

    if not args.non_interactive:
        confirm = input("Proceed? (y/N): ").strip().lower()
        if confirm != 'y':
            print("❌ Cancelled")
            return 1

    print()
    print("Creating admin user...")

    success = create_admin_user(username, email, password, role)

    if success:
        print()
        print("✅ Admin user created successfully!")
        print()
        print(f"  Username: {username}")
        print(f"  Email:    {email}")
        print(f"  Role:     {role}")
        print()
        print("You can now log in using these credentials.")
        print("=" * 70)
        return 0
    else:
        print()
        print("❌ Failed to create admin user")
        print("   Check logs for details or ensure the user doesn't already exist")
        print("=" * 70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
