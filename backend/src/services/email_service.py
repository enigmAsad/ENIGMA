"""Email notification service."""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from src.config.settings import get_settings
from src.utils.logger import get_logger, AuditLogger


logger = get_logger("email_service")


class EmailService:
    """Service for sending email notifications."""

    def __init__(self, audit_logger: Optional[AuditLogger] = None):
        """Initialize email service.

        Args:
            audit_logger: Optional AuditLogger instance
        """
        self.settings = get_settings()
        self.audit_logger = audit_logger

        # Check if email is configured
        if not self.settings.is_email_configured():
            logger.warning("Email service not fully configured. Emails will be logged only.")

    def _send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None
    ) -> bool:
        """Send an email.

        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML email body
            body_text: Plain text email body (optional)

        Returns:
            bool: True if sent successfully
        """
        if not self.settings.is_email_configured():
            logger.info(
                f"[EMAIL NOT SENT - Not Configured]\n"
                f"To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Body:\n{body_text or body_html}"
            )
            return False

        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = self.settings.email_from
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

            # Attach text and HTML parts
            if body_text:
                msg.attach(MIMEText(body_text, 'plain'))
            msg.attach(MIMEText(body_html, 'html'))

            # Connect and send
            with smtplib.SMTP(
                self.settings.email_smtp_host,
                self.settings.email_smtp_port
            ) as server:
                if self.settings.email_use_tls:
                    server.starttls()

                server.login(self.settings.email_from, self.settings.email_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    def send_application_confirmation(
        self,
        to_email: str,
        applicant_name: str,
        application_id: str
    ) -> bool:
        """Send application submission confirmation.

        Args:
            to_email: Applicant email
            applicant_name: Applicant name
            application_id: Application ID

        Returns:
            bool: True if sent successfully
        """
        subject = "ENIGMA Application Received"

        body_html = f"""
        <html>
        <body>
            <h2>Application Received</h2>
            <p>Dear {applicant_name},</p>
            <p>Thank you for submitting your application to ENIGMA. We have received your application and it is being processed.</p>
            <p><strong>Application ID:</strong> {application_id}</p>
            <p>Your application will undergo a blind merit-based evaluation process. You will be notified of the results within 2-3 weeks.</p>
            <p>Best regards,<br>ENIGMA Admissions Team</p>
        </body>
        </html>
        """

        body_text = f"""
Application Received

Dear {applicant_name},

Thank you for submitting your application to ENIGMA. We have received your application and it is being processed.

Application ID: {application_id}

Your application will undergo a blind merit-based evaluation process. You will be notified of the results within 2-3 weeks.

Best regards,
ENIGMA Admissions Team
        """

        success = self._send_email(to_email, subject, body_html, body_text)

        # Audit log
        if self.audit_logger and success:
            self.audit_logger.log_notification_sent(
                application_id=application_id,
                notification_type="confirmation",
                recipient=to_email
            )

        return success

    def send_shortlist_notification(
        self,
        to_email: str,
        applicant_name: str,
        application_id: str,
        score: float
    ) -> bool:
        """Send shortlist notification (Phase 1 passed).

        Args:
            to_email: Applicant email
            applicant_name: Applicant name
            application_id: Application ID
            score: Phase 1 score

        Returns:
            bool: True if sent successfully
        """
        subject = "ENIGMA Application Update - Shortlisted"

        body_html = f"""
        <html>
        <body>
            <h2>Congratulations! You've Been Shortlisted</h2>
            <p>Dear {applicant_name},</p>
            <p>We are pleased to inform you that your application has successfully passed Phase 1 of our evaluation process.</p>
            <p><strong>Application ID:</strong> {application_id}</p>
            <p><strong>Phase 1 Score:</strong> {score:.2f}/100</p>
            <p>You will be contacted shortly regarding Phase 2 (live interview) scheduling.</p>
            <p>Best regards,<br>ENIGMA Admissions Team</p>
        </body>
        </html>
        """

        body_text = f"""
Congratulations! You've Been Shortlisted

Dear {applicant_name},

We are pleased to inform you that your application has successfully passed Phase 1 of our evaluation process.

Application ID: {application_id}
Phase 1 Score: {score:.2f}/100

You will be contacted shortly regarding Phase 2 (live interview) scheduling.

Best regards,
ENIGMA Admissions Team
        """

        success = self._send_email(to_email, subject, body_html, body_text)

        # Audit log
        if self.audit_logger and success:
            self.audit_logger.log_notification_sent(
                application_id=application_id,
                notification_type="shortlist",
                recipient=to_email
            )

        return success

    def send_final_results(
        self,
        to_email: str,
        applicant_name: str,
        application_id: str,
        anonymized_id: str,
        final_score: float,
        explanation: str,
        verification_hash: str
    ) -> bool:
        """Send final evaluation results.

        Args:
            to_email: Applicant email
            applicant_name: Applicant name
            application_id: Application ID
            anonymized_id: Anonymized ID for verification
            final_score: Final combined score
            explanation: Evaluation explanation
            verification_hash: Hash for verification

        Returns:
            bool: True if sent successfully
        """
        subject = "ENIGMA Application - Final Results"

        body_html = f"""
        <html>
        <body>
            <h2>Your ENIGMA Application Results</h2>
            <p>Dear {applicant_name},</p>
            <p>Your application evaluation is complete.</p>
            <p><strong>Application ID:</strong> {application_id}</p>
            <p><strong>Final Score:</strong> {final_score:.2f}/100</p>
            <h3>Evaluation Summary</h3>
            <p>{explanation}</p>
            <h3>Verification</h3>
            <p>Verification Hash: <code>{verification_hash}</code></p>
            <p>You can verify the integrity of your evaluation at: [Verification Portal URL]</p>
            <p>If you have questions or wish to appeal, please contact admissions@enigma.edu</p>
            <p>Best regards,<br>ENIGMA Admissions Team</p>
        </body>
        </html>
        """

        body_text = f"""
Your ENIGMA Application Results

Dear {applicant_name},

Your application evaluation is complete.

Application ID: {application_id}
Final Score: {final_score:.2f}/100

Evaluation Summary:
{explanation}

Verification:
Verification Hash: {verification_hash}

You can verify the integrity of your evaluation at: [Verification Portal URL]

If you have questions or wish to appeal, please contact admissions@enigma.edu

Best regards,
ENIGMA Admissions Team
        """

        success = self._send_email(to_email, subject, body_html, body_text)

        # Audit log
        if self.audit_logger and success:
            self.audit_logger.log_notification_sent(
                application_id=application_id,
                notification_type="final_results",
                recipient=to_email
            )

        return success
