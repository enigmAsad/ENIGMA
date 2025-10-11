#!/usr/bin/env python
"""CLI tool to create admin users for ENIGMA."""

import argparse
from src.services.admin_auth import AdminAuthService
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger

logger = get_logger("create_admin")


def main():
    """Create admin user via CLI."""
    parser = argparse.ArgumentParser(description="Create ENIGMA admin user")
    parser.add_argument('--username', required=True, help="Admin username")
    parser.add_argument('--password', required=True, help="Admin password")
    parser.add_argument('--email', required=True, help="Admin email")
    parser.add_argument('--role', default='admin', choices=['admin', 'super_admin'],
                        help="Admin role (default: admin)")

    args = parser.parse_args()

    try:
        csv_handler = CSVHandler()
        auth_service = AdminAuthService(csv_handler)

        admin = auth_service.create_admin_user(
            username=args.username,
            password=args.password,
            email=args.email,
            role=args.role
        )

        print(f"\n✅ Admin user created successfully!")
        print(f"   Admin ID: {admin.admin_id}")
        print(f"   Username: {admin.username}")
        print(f"   Email:    {admin.email}")
        print(f"   Role:     {admin.role}")
        print(f"\nYou can now login at: http://localhost:3000/admin/login\n")

    except ValueError as e:
        print(f"\n❌ Error: {e}\n")
        return 1
    except Exception as e:
        logger.error(f"Failed to create admin: {e}")
        print(f"\n❌ Failed to create admin: {e}\n")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
