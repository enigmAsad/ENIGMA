"""Configuration management for ENIGMA Phase 1 backend."""

import os
from pathlib import Path
from functools import lru_cache
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the backend directory (project root) - 3 levels up from this file
# settings.py is in: backend/src/config/settings.py
# .env is in: backend/.env
_BACKEND_DIR = Path(__file__).parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # OpenAI API Configuration
    openai_api_key: str = Field(
        ...,
        description="OpenAI API key for GPT models"
    )

    # LLM Model Configuration
    worker_model: str = Field(
        default="gpt-5",
        description="GPT model for Worker evaluation (gpt-5 for complex reasoning)"
    )
    judge_model: str = Field(
        default="gpt-5-mini",
        description="GPT model for Judge validation (gpt-5-mini for efficient validation)"
    )
    temperature: float = Field(
        default=0.1,
        ge=0.0,
        le=2.0,
        description="LLM temperature for consistency (NOTE: Not supported by GPT-5 series, kept for compatibility)"
    )
    max_tokens: int = Field(
        default=4096,
        ge=1024,
        le=8192,
        description="Maximum tokens for LLM responses (NOTE: Not supported by GPT-5 series, kept for compatibility)"
    )

    # Retry Configuration
    max_retry_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum Worker retry attempts before failure"
    )
    api_retry_delay: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Initial delay for API retry backoff (seconds)"
    )
    api_max_retries: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum API call retries for transient errors"
    )

    # Database Configuration
    database_url: str = Field(
        ...,
        description="PostgreSQL database URL (Supabase transaction pooler)"
    )
    database_pool_size: int = Field(
        default=20,
        ge=5,
        le=50,
        description="Database connection pool size"
    )
    database_max_overflow: int = Field(
        default=0,
        ge=0,
        le=20,
        description="Maximum overflow connections beyond pool size"
    )
    database_pool_timeout: float = Field(
        default=30.0,
        ge=5.0,
        le=60.0,
        description="Database connection timeout in seconds"
    )
    database_echo: bool = Field(
        default=False,
        description="Echo SQL statements (for debugging)"
    )

    # Data Paths
    prompt_dir: Path = Field(
        default=Path("./prompts"),
        description="Directory for LLM prompts"
    )
    log_dir: Path = Field(
        default=Path("./logs"),
        description="Directory for application logs"
    )
    batch_export_dir: Path = Field(
        default=Path("./batch_exports"),
        description="Directory for batch JSONL exports"
    )

    # Email Configuration (SMTP)
    email_smtp_host: Optional[str] = Field(
        default=None,
        description="SMTP server host"
    )
    email_smtp_port: int = Field(
        default=587,
        ge=1,
        le=65535,
        description="SMTP server port"
    )
    email_from: Optional[str] = Field(
        default=None,
        description="From email address"
    )
    email_password: Optional[str] = Field(
        default=None,
        description="Email account password"
    )
    email_use_tls: bool = Field(
        default=True,
        description="Use TLS for SMTP"
    )

    # Security
    encryption_key: str = Field(
        ...,
        description="Fernet encryption key for PII (generate with: Fernet.generate_key())"
    )
    jwt_secret: str = Field(
        ...,
        description="JWT secret key for admin authentication (256-bit random)"
    )
    admin_token_expiry_hours: int = Field(
        default=24,
        ge=1,
        le=168,  # Max 1 week
        description="Admin JWT token expiry time in hours"
    )

    # Student OAuth Configuration
    google_client_id: str = Field(
        ...,
        description="Google OAuth 2.0 client ID"
    )
    google_client_secret: str = Field(
        ...,
        description="Google OAuth 2.0 client secret"
    )
    google_oauth_redirect_base: str = Field(
        ...,
        description="Base URL used to compute OAuth redirect URIs"
    )
    student_session_ttl_hours: int = Field(
        default=8,
        ge=1,
        le=72,
        description="Student session lifetime in hours"
    )

    # Bias Monitoring Configuration
    enable_bias_monitoring: bool = Field(
        default=True,
        description="Enable real-time bias monitoring during interviews"
    )
    bias_detection_model: str = Field(
        default="gpt-5-mini",
        description="LLM model for bias detection (gpt-5-mini for fast, accurate analysis)"
    )

    # Nudge Thresholds (confidence scores)
    nudge_threshold_low: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for info nudges"
    )
    nudge_threshold_medium: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for warning nudges"
    )
    nudge_threshold_high: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Confidence threshold for blocking interview"
    )

    # Strike Configuration
    strike_limit_per_interview: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Strike limit before blocking interview"
    )
    strike_limit_per_cycle: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Strike limit before admin suspension"
    )
    strike_reset_days: int = Field(
        default=90,
        ge=30,
        le=365,
        description="Days of clean record before strike reset"
    )

    # STT Configuration
    stt_chunk_duration_seconds: int = Field(
        default=30,
        ge=5,
        le=30,
        description="Audio chunk duration for STT processing (seconds)"
    )
    transcript_retention_days: int = Field(
        default=365,
        ge=30,
        le=3650,
        description="How long to retain interview transcripts (days)"
    )

    # Logging
    log_level: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"
    )
    log_file: Optional[Path] = Field(
        default=None,
        description="Log file path (None for console only)"
    )

    # Application Settings
    debug: bool = Field(
        default=False,
        description="Enable debug mode (e.g., for non-secure cookies)"
    )
    max_applications_per_batch: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Maximum applications to process in single batch"
    )
    enable_parallel_processing: bool = Field(
        default=True,
        description="Enable parallel processing of applications"
    )

    # Scoring Weights (for Worker evaluation)
    weight_academic: float = Field(
        default=0.30,
        ge=0.0,
        le=1.0,
        description="Weight for academic score"
    )
    weight_test: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        description="Weight for test score"
    )
    weight_achievement: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        description="Weight for achievement score"
    )
    weight_essay: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
        description="Weight for essay score"
    )

    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Ensure log level is valid."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f"log_level must be one of {valid_levels}")
        return v_upper

    @field_validator('prompt_dir', 'log_dir', 'batch_export_dir')
    @classmethod
    def ensure_path_exists(cls, v: Path) -> Path:
        """Create directories if they don't exist."""
        v = Path(v)
        v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator('encryption_key')
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        """Validate Fernet encryption key format."""
        from cryptography.fernet import Fernet
        try:
            # Test if it's a valid Fernet key
            Fernet(v.encode())
        except Exception as e:
            raise ValueError(f"Invalid Fernet encryption key: {e}")
        return v

    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL format."""
        if not v or not v.startswith(('postgresql://', 'postgresql+psycopg2://')):
            raise ValueError("database_url must be a valid PostgreSQL connection string")
        return v

    def validate_scoring_weights(self) -> None:
        """Ensure scoring weights sum to approximately 1.0."""
        total_weight = (
            self.weight_academic +
            self.weight_test +
            self.weight_achievement +
            self.weight_essay
        )
        if abs(total_weight - 1.0) > 0.01:
            raise ValueError(
                f"Scoring weights must sum to 1.0, got {total_weight}. "
                f"Current: academic={self.weight_academic}, test={self.weight_test}, "
                f"achievement={self.weight_achievement}, essay={self.weight_essay}"
            )

    def get_prompt_path(self, prompt_name: str) -> Path:
        """Get full path for a prompt file."""
        return self.prompt_dir / prompt_name

    def load_prompt(self, prompt_name: str) -> str:
        """Load prompt from file."""
        prompt_path = self.get_prompt_path(prompt_name)
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text(encoding="utf-8")

    def is_email_configured(self) -> bool:
        """Check if email configuration is complete."""
        return all([
            self.email_smtp_host,
            self.email_from,
            self.email_password
        ])


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance.

    Uses lru_cache to ensure settings are loaded only once.
    Call this function to access settings throughout the application.

    Returns:
        Settings: Cached settings instance

    Raises:
        ValidationError: If environment configuration is invalid
    """
    settings = Settings()

    # Validate scoring weights on initialization
    settings.validate_scoring_weights()

    return settings


# Convenience functions

def get_prompt_dir() -> Path:
    """Get prompt directory path."""
    return get_settings().prompt_dir


def get_log_dir() -> Path:
    """Get log directory path."""
    return get_settings().log_dir


def load_prompt(prompt_name: str) -> str:
    """Load prompt file by name.

    Args:
        prompt_name: Name of prompt file (e.g., 'worker_prompt.txt')

    Returns:
        str: Prompt content

    Raises:
        FileNotFoundError: If prompt file doesn't exist
    """
    return get_settings().load_prompt(prompt_name)


# Initialize directories on module import
def _init_directories():
    """Initialize required directories."""
    settings = get_settings()

    # Ensure all directories exist
    settings.prompt_dir.mkdir(parents=True, exist_ok=True)
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    settings.batch_export_dir.mkdir(parents=True, exist_ok=True)

    # Create .gitkeep files if they don't exist
    (settings.log_dir / ".gitkeep").touch(exist_ok=True)
    (settings.batch_export_dir / ".gitkeep").touch(exist_ok=True)


# Auto-initialize on import (only if .env exists)
if _ENV_FILE.exists():
    try:
        _init_directories()
    except Exception:
        # Silently fail during import - will be caught when get_settings() is called
        pass
