#!/usr/bin/env python
"""Generate encryption and JWT secret keys for ENIGMA backend.

This script generates cryptographically secure keys for:
1. Fernet encryption key (for PII encryption)
2. JWT secret key (for admin authentication)

Usage:
    python scripts/generate_keys.py
"""

import secrets
from cryptography.fernet import Fernet


def generate_encryption_key() -> str:
    """Generate a Fernet encryption key.

    Returns:
        str: Base64-encoded Fernet key
    """
    return Fernet.generate_key().decode()


def generate_jwt_secret() -> str:
    """Generate a secure JWT secret key.

    Returns:
        str: URL-safe base64-encoded secret (32 bytes)
    """
    return secrets.token_urlsafe(32)


def main():
    """Generate and display keys."""
    print("=" * 70)
    print("ENIGMA Backend - Security Key Generator")
    print("=" * 70)
    print()
    print("⚠️  SECURITY WARNING:")
    print("   - Never commit these keys to version control")
    print("   - Store them securely in your .env file")
    print("   - Rotate keys periodically in production")
    print()
    print("=" * 70)
    print()

    encryption_key = generate_encryption_key()
    jwt_secret = generate_jwt_secret()

    print("🔐 ENCRYPTION_KEY (Fernet - for PII encryption):")
    print(f"   {encryption_key}")
    print()

    print("🔑 JWT_SECRET (for admin authentication):")
    print(f"   {jwt_secret}")
    print()

    print("=" * 70)
    print()
    print("📝 Add these to your backend/.env file:")
    print()
    print(f"ENCRYPTION_KEY={encryption_key}")
    print(f"JWT_SECRET={jwt_secret}")
    print()
    print("=" * 70)


if __name__ == "__main__":
    main()
