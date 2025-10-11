"""Identity scrubbing engine for PII removal and anonymization."""

import re
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

from src.models.schemas import Application, AnonymizedApplication
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger, AuditLogger


logger = get_logger("identity_scrubber")


class IdentityScrubber:
    """Engine for removing PII and creating anonymized applications."""

    def __init__(self, csv_handler: CSVHandler, audit_logger: Optional[AuditLogger] = None):
        """Initialize identity scrubber.

        Args:
            csv_handler: CSVHandler instance
            audit_logger: Optional AuditLogger instance
        """
        self.csv_handler = csv_handler
        self.audit_logger = audit_logger

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

        # Common name indicators (for basic name detection without NER)
        self._name_indicators = [
            "my name is", "i am", "i'm", "called", "known as",
            "mr.", "mrs.", "ms.", "dr.", "prof."
        ]

        # Location indicators
        self._location_indicators = [
            "from", "live in", "residing in", "located in", "based in",
            "city", "town", "village", "country", "province", "state"
        ]

        # Institution patterns
        self._institution_pattern = re.compile(
            r'\b(?:university|college|school|academy|institute)\s+(?:of\s+)?[A-Z][A-Za-z\s]+',
            re.IGNORECASE
        )

    def _scrub_emails(self, text: str) -> str:
        """Remove email addresses from text.

        Args:
            text: Input text

        Returns:
            str: Text with emails replaced
        """
        return self._email_pattern.sub('[EMAIL_REDACTED]', text)

    def _scrub_phones(self, text: str) -> str:
        """Remove phone numbers from text.

        Args:
            text: Input text

        Returns:
            str: Text with phone numbers replaced
        """
        return self._phone_pattern.sub('[PHONE_REDACTED]', text)

    def _scrub_urls(self, text: str) -> str:
        """Remove URLs from text.

        Args:
            text: Input text

        Returns:
            str: Text with URLs replaced
        """
        return self._url_pattern.sub('[URL_REDACTED]', text)

    def _scrub_social_media(self, text: str) -> str:
        """Remove social media handles and links.

        Args:
            text: Input text

        Returns:
            str: Text with social media references replaced
        """
        return self._social_media_pattern.sub('[SOCIAL_MEDIA_REDACTED]', text)

    def _scrub_institutions(self, text: str) -> str:
        """Remove specific institution names.

        Args:
            text: Input text

        Returns:
            str: Text with institution names replaced
        """
        return self._institution_pattern.sub('[INSTITUTION_REDACTED]', text)

    def _scrub_name_contexts(self, text: str) -> str:
        """Remove text following name indicators.

        Args:
            text: Input text

        Returns:
            str: Text with names in context replaced
        """
        result = text

        for indicator in self._name_indicators:
            # Pattern: indicator followed by 1-4 capitalized words
            pattern = re.compile(
                rf'{re.escape(indicator)}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){{0,3}})',
                re.IGNORECASE
            )
            result = pattern.sub(f'{indicator} [NAME_REDACTED]', result)

        return result

    def _scrub_location_contexts(self, text: str) -> str:
        """Remove location information following indicators.

        Args:
            text: Input text

        Returns:
            str: Text with locations replaced
        """
        result = text

        for indicator in self._location_indicators:
            # Pattern: indicator followed by capitalized location names
            pattern = re.compile(
                rf'{re.escape(indicator)}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
                re.IGNORECASE
            )
            result = pattern.sub(f'{indicator} [LOCATION_REDACTED]', result)

        return result

    def _scrub_numbers(self, text: str) -> str:
        """Replace specific identification numbers.

        Args:
            text: Input text

        Returns:
            str: Text with ID numbers replaced
        """
        # National ID patterns (common formats)
        id_patterns = [
            r'\b\d{5}-\d{7}-\d{1}\b',  # Pakistan CNIC format
            r'\b[A-Z]{2}\d{2}[A-Z]{1}\d{4}[A-Z]{1}\b',  # Some passport formats
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

        # Apply scrubbing in sequence
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
        """Generate anonymized ID from application ID.

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

    def scrub_application(self, application: Application) -> AnonymizedApplication:
        """Scrub PII from application and create anonymized version.

        Args:
            application: Original application

        Returns:
            AnonymizedApplication: Anonymized application
        """
        logger.info(f"Scrubbing application: {application.application_id}")

        # Generate anonymized ID
        anonymized_id = self.generate_anonymized_id(application.application_id)

        # Scrub essay
        essay_scrubbed = self.scrub_text(application.essay)

        # Scrub achievements
        achievements_scrubbed = self.scrub_text(application.achievements)

        # Track what was removed
        pii_fields_removed = ["name", "email", "phone", "address"]

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
        logger.info(f"Applied {total_redactions} redactions to {application.application_id}")
        logger.debug(f"Redaction breakdown: {redaction_counts}")

        # Create anonymized application
        anonymized = AnonymizedApplication(
            anonymized_id=anonymized_id,
            application_id=application.application_id,
            gpa=application.gpa,
            test_scores=application.test_scores,
            essay_scrubbed=essay_scrubbed,
            achievements_scrubbed=achievements_scrubbed,
            created_at=datetime.utcnow()
        )

        # Persist anonymized application
        self.csv_handler.append_anonymized_application(anonymized)

        # Store identity mapping (encrypted in production)
        self._store_identity_mapping(
            anonymized_id=anonymized_id,
            application_id=application.application_id,
            pii_data={
                "name": application.name,
                "email": application.email,
                "phone": application.phone,
                "address": application.address
            }
        )

        # Audit log
        if self.audit_logger:
            self.audit_logger.log_identity_scrubbing(
                application_id=application.application_id,
                anonymized_id=anonymized_id,
                pii_fields_removed=pii_fields_removed
            )

        logger.info(
            f"Successfully scrubbed application {application.application_id} → {anonymized_id}"
        )

        return anonymized

    def _store_identity_mapping(
        self,
        anonymized_id: str,
        application_id: str,
        pii_data: Dict[str, Any]
    ):
        """Store identity mapping for later retrieval.

        In production, this should be encrypted and stored separately.

        Args:
            anonymized_id: Anonymized ID
            application_id: Original application ID
            pii_data: PII data to store (will be encrypted)
        """
        # Serialize PII data
        pii_json = json.dumps(pii_data)

        # In production, encrypt pii_json here using settings.identity_mapping_encryption_key
        # For MVP, store as base64 encoded
        import base64
        encrypted_pii = base64.b64encode(pii_json.encode('utf-8')).decode('utf-8')

        # Create CSV row
        mapping_row = [
            anonymized_id,
            application_id,
            encrypted_pii,
            datetime.utcnow().isoformat()
        ]

        # Append to identity mapping CSV
        mapping_csv = self.csv_handler._get_csv_path(self.csv_handler.IDENTITY_MAPPING_CSV)
        lock = self.csv_handler._get_lock(self.csv_handler.IDENTITY_MAPPING_CSV)

        with lock:
            self.csv_handler._atomic_write(mapping_csv, [mapping_row], mode='a')

        logger.debug(f"Stored identity mapping: {anonymized_id} ← {application_id}")

    def retrieve_identity(self, anonymized_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve original identity from anonymized ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[Dict[str, Any]]: PII data if found
        """
        import base64

        mapping_rows = self.csv_handler._read_csv(self.csv_handler.IDENTITY_MAPPING_CSV)

        for row in mapping_rows:
            if row['anonymized_id'] == anonymized_id:
                # Decrypt PII data
                encrypted_pii = row['encrypted_pii']

                # For MVP, decode from base64
                pii_json = base64.b64decode(encrypted_pii).decode('utf-8')
                pii_data = json.loads(pii_json)

                return pii_data

        return None

    def get_application_id(self, anonymized_id: str) -> Optional[str]:
        """Get original application ID from anonymized ID.

        Args:
            anonymized_id: Anonymized ID

        Returns:
            Optional[str]: Original application ID if found
        """
        mapping_rows = self.csv_handler._read_csv(self.csv_handler.IDENTITY_MAPPING_CSV)

        for row in mapping_rows:
            if row['anonymized_id'] == anonymized_id:
                return row['application_id']

        return None
