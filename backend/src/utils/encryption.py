"""Encryption utilities for PII protection using Fernet symmetric encryption."""

import json
from typing import Dict, Any
from cryptography.fernet import Fernet

from src.config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("encryption")


class EncryptionService:
    """Service for encrypting and decrypting PII data."""

    def __init__(self):
        """Initialize encryption service with Fernet cipher."""
        settings = get_settings()
        self.cipher = Fernet(settings.encryption_key.encode())

    def encrypt_pii(self, pii_data: Dict[str, Any]) -> str:
        """Encrypt PII data dictionary to encrypted string.

        Args:
            pii_data: Dictionary containing PII fields

        Returns:
            str: Fernet-encrypted string

        Example:
            >>> pii = {"name": "John Doe", "email": "john@example.com"}
            >>> encrypted = service.encrypt_pii(pii)
        """
        try:
            # Convert dict to JSON string
            json_str = json.dumps(pii_data, sort_keys=True)

            # Encrypt
            encrypted_bytes = self.cipher.encrypt(json_str.encode('utf-8'))

            # Return as string
            return encrypted_bytes.decode('utf-8')

        except Exception as e:
            logger.error(f"PII encryption failed: {e}")
            raise ValueError(f"Failed to encrypt PII: {e}")

    def decrypt_pii(self, encrypted_pii: str) -> Dict[str, Any]:
        """Decrypt encrypted PII string back to dictionary.

        Args:
            encrypted_pii: Fernet-encrypted PII string

        Returns:
            Dict[str, Any]: Decrypted PII dictionary

        Raises:
            ValueError: If decryption fails

        Example:
            >>> encrypted = "gAAAAABh..."
            >>> pii = service.decrypt_pii(encrypted)
            >>> print(pii["name"])  # "John Doe"
        """
        try:
            # Decrypt
            decrypted_bytes = self.cipher.decrypt(encrypted_pii.encode('utf-8'))

            # Parse JSON
            json_str = decrypted_bytes.decode('utf-8')
            pii_data = json.loads(json_str)

            return pii_data

        except Exception as e:
            logger.error(f"PII decryption failed: {e}")
            raise ValueError(f"Failed to decrypt PII: {e}")

    def create_pii_dict(
        self,
        name: str,
        email: str,
        phone: str = None,
        address: str = None
    ) -> Dict[str, str]:
        """Create a PII dictionary from individual fields.

        Args:
            name: Applicant name
            email: Applicant email
            phone: Optional phone number
            address: Optional address

        Returns:
            Dict[str, str]: PII dictionary ready for encryption
        """
        pii = {
            "name": name,
            "email": email
        }

        if phone:
            pii["phone"] = phone

        if address:
            pii["address"] = address

        return pii


# Global instance
_encryption_service = None


def get_encryption_service() -> EncryptionService:
    """Get singleton encryption service instance.

    Returns:
        EncryptionService: Global encryption service
    """
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
