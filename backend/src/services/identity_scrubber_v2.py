"""Identity scrubbing engine for PII removal using PostgreSQL and Fernet encryption."""

import re
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy.orm import Session

from src.models.schemas import Application, AnonymizedApplication
from src.database.repositories import ApplicationRepository, AuditRepository
from src.database.models import AuditActionEnum
from src.utils.encryption import get_encryption_service
from src.utils.logger import get_logger

logger = get_logger("identity_scrubber")


class IdentityScrubberV2:
    """PostgreSQL-based engine for removing PII and creating anonymized applications."""

    def __init__(self, db: Session):
        """Initialize identity scrubber.

        Args:
            db: Database session
        """
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.audit_repo = AuditRepository(db)
        self.encryption_service = get_encryption_service()

        # Compile regex patterns for performance
        self._email_pattern = re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            re.IGNORECASE
        )
        self._phone_pattern = re.compile(
            r'(\+?\d{1,4}[-.\s]?)?(\(?\d{1,4}\)?[-.\s]?)?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            re.IGNORECASE
        )
        self._url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+',
            re.IGNORECASE
        )
        self._social_media_pattern = re.compile(
            r'@[A-Za-z0-9_]+|(?:facebook|twitter|instagram|linkedin|github)\.com/[A-Za-z0-9_-]+',
            re.IGNORECASE
        )
        self._name_indicators = [
            "my name is", "i am", "i'm", "called", "known as",
            "mr.", "mrs.", "ms.", "dr.", "prof."
        ]
        self._location_indicators = [
            "from", "live in", "residing in", "located in", "based in",
            "city", "town", "village", "country", "province", "state"
        ]
        self._institution_pattern = re.compile(
            r'\b(?:university|college|school|academy|institute)\s+(?:of\s+)?[A-Z][A-Za-z\s]+',
            re.IGNORECASE
        )

    def _scrub_emails(self, text: str) -> str:
        """Remove email addresses from text."""
        return self._email_pattern.sub('[EMAIL_REDACTED]', text)

    def _scrub_phones(self, text: str) -> str:
        """Remove phone numbers from text."""
        return self._phone_pattern.sub('[PHONE_REDACTED]', text)

    def _scrub_urls(self, text: str) -> str:
        """Remove URLs from text."""
        return self._url_pattern.sub('[URL_REDACTED]', text)

    def _scrub_social_media(self, text: str) -> str:
        """Remove social media handles and links."""
        return self._social_media_pattern.sub('[SOCIAL_MEDIA_REDACTED]', text)

    def _scrub_institutions(self, text: str) -> str:
        """Remove specific institution names."""
        return self._institution_pattern.sub('[INSTITUTION_REDACTED]', text)

    def _scrub_name_contexts(self, text: str) -> str:
        """Remove text following name indicators."""
        result = text
        for indicator in self._name_indicators:
            pattern = re.compile(
                rf'{re.escape(indicator)}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){{0,3}})',
                re.IGNORECASE
            )
            result = pattern.sub(f'{indicator} [NAME_REDACTED]', result)
        return result

    def _scrub_location_contexts(self, text: str) -> str:
        """Remove location information following indicators."""
        result = text
        for indicator in self._location_indicators:
            pattern = re.compile(
                rf'{re.escape(indicator)}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
                re.IGNORECASE
            )
            result = pattern.sub(f'{indicator} [LOCATION_REDACTED]', result)
        return result

    def _scrub_numbers(self, text: str) -> str:
        """Replace specific identification numbers."""
        id_patterns = [
            r'\b\d{5}-\d{7}-\d{1}\b',  # Pakistan CNIC
            r'\b[A-Z]{2}\d{2}[A-Z]{1}\d{4}[A-Z]{1}\b',  # Passport formats
            r'\b\d{3}-\d{2}-\d{4}\b',  # SSN format
        ]
        result = text
        for pattern in id_patterns:
            result = re.sub(pattern, '[ID_REDACTED]', result)
        return result

    def scrub_text(self, text: str) -> str:
        """Apply all scrubbing rules to text.

        Args:
            text: Input text

        Returns:
            str: Scrubbed text with PII removed
        """
        if not text:
            return text

        scrubbed = text
        scrubbed = self._scrub_emails(scrubbed)
        scrubbed = self._scrub_phones(scrubbed)
        scrubbed = self._scrub_urls(scrubbed)
        scrubbed = self._scrub_social_media(scrubbed)
        scrubbed = self._scrub_numbers(scrubbed)
        scrubbed = self._scrub_institutions(scrubbed)
        scrubbed = self._scrub_name_contexts(scrubbed)
        scrubbed = self._scrub_location_contexts(scrubbed)

        return scrubbed

    def generate_anonymized_id(self, application_id: str) -> str:
        """Generate anonymized ID.

        Format: ANON_{timestamp_ms}_{random_6_chars}

        Args:
            application_id: Original application ID

        Returns:
            str: Anonymized ID
        """
        import uuid
        timestamp_ms = int(datetime.utcnow().timestamp() * 1000)
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f"ANON_{timestamp_ms}_{random_suffix}"

    def scrub_application(self, application_id: str) -> AnonymizedApplication:
        """Scrub PII from application and create anonymized version.

        Args:
            application_id: Application ID to scrub

        Returns:
            AnonymizedApplication: Anonymized application

        Raises:
            ValueError: If application not found
        """
        logger.info(f"Scrubbing application: {application_id}")

        # Get application from database
        application = self.app_repo.get_by_application_id(application_id)
        if not application:
            raise ValueError(f"Application {application_id} not found")

        # Check if already anonymized
        existing_anon = self.app_repo.get_anonymized_by_application_id(application_id)
        if existing_anon:
            logger.warning(f"Application {application_id} already anonymized as {existing_anon.anonymized_id}")
            return existing_anon

        # Generate anonymized ID
        anonymized_id = self.generate_anonymized_id(application_id)

        # Scrub essay and achievements
        essay_scrubbed = self.scrub_text(application.essay)
        achievements_scrubbed = self.scrub_text(application.achievements)

        # Count redactions
        redaction_counts = {
            "EMAIL_REDACTED": essay_scrubbed.count('[EMAIL_REDACTED]') + achievements_scrubbed.count('[EMAIL_REDACTED]'),
            "PHONE_REDACTED": essay_scrubbed.count('[PHONE_REDACTED]') + achievements_scrubbed.count('[PHONE_REDACTED]'),
            "URL_REDACTED": essay_scrubbed.count('[URL_REDACTED]') + achievements_scrubbed.count('[URL_REDACTED]'),
            "NAME_REDACTED": essay_scrubbed.count('[NAME_REDACTED]') + achievements_scrubbed.count('[NAME_REDACTED]'),
            "LOCATION_REDACTED": essay_scrubbed.count('[LOCATION_REDACTED]') + achievements_scrubbed.count('[LOCATION_REDACTED]'),
            "INSTITUTION_REDACTED": essay_scrubbed.count('[INSTITUTION_REDACTED]') + achievements_scrubbed.count('[INSTITUTION_REDACTED]'),
        }

        total_redactions = sum(redaction_counts.values())
        logger.info(f"Applied {total_redactions} redactions to {application_id}")
        logger.debug(f"Redaction breakdown: {redaction_counts}")

        # Create anonymized application in database
        anonymized = self.app_repo.create_anonymized(
            anonymized_id=anonymized_id,
            application_id=application_id,
            gpa=application.gpa,
            test_scores=application.test_scores,
            essay_scrubbed=essay_scrubbed,
            achievements_scrubbed=achievements_scrubbed
        )

        # Store identity mapping with Fernet encryption
        pii_data = self.encryption_service.create_pii_dict(
            name=application.name,
            email=application.email,
            phone=application.phone,
            address=application.address
        )
        encrypted_pii = self.encryption_service.encrypt_pii(pii_data)

        self.app_repo.create_identity_mapping(
            anonymized_id=anonymized_id,
            application_id=application_id,
            encrypted_pii=encrypted_pii
        )

        # Create audit log
        self.audit_repo.create_audit_log(
            entity_type="Application",
            entity_id=application_id,
            action=AuditActionEnum.EVALUATE,
            actor="identity_scrubber",
            details={
                "anonymized_id": anonymized_id,
                "redaction_counts": redaction_counts,
                "total_redactions": total_redactions
            }
        )

        # Commit transaction
        self.db.commit()

        logger.info(f"Successfully scrubbed {application_id} → {anonymized_id}")
        return anonymized

    def retrieve_identity(self, anonymized_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve original identity from anonymized ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[Dict[str, Any]]: PII data if found
        """
        mapping = self.app_repo.get_identity_mapping(anonymized_id)
        if not mapping:
            return None

        # Decrypt PII
        try:
            pii_data = self.encryption_service.decrypt_pii(mapping.encrypted_pii)
            return pii_data
        except Exception as e:
            logger.error(f"Failed to decrypt PII for {anonymized_id}: {e}")
            return None

    def get_application_id(self, anonymized_id: str) -> Optional[str]:
        """Get original application ID from anonymized ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[str]: Original application ID if found
        """
        anon_app = self.app_repo.get_anonymized_by_id(anonymized_id)
        return anon_app.application_id if anon_app else None
