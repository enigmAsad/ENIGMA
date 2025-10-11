"""Configuration management for ENIGMA Phase 1 backend."""

import os
from pathlib import Path
from functools import lru_cache
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Anthropic API Configuration
    anthropic_api_key: str = Field(
        ...,
        description="Anthropic API key for Claude models"
    )

    # LLM Model Configuration
    worker_model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Claude model for Worker evaluation"
    )
    judge_model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Claude model for Judge validation"
    )
    temperature: float = Field(
        default=0.1,
        ge=0.0,
        le=2.0,
        description="LLM temperature for consistency"
    )
    max_tokens: int = Field(
        default=4096,
        ge=1024,
        le=8192,
        description="Maximum tokens for LLM responses"
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

    # Data Paths
    data_dir: Path = Field(
        default=Path("./data"),
        description="Directory for CSV data storage"
    )
    prompt_dir: Path = Field(
        default=Path("./prompts"),
        description="Directory for LLM prompts"
    )
    log_dir: Path = Field(
        default=Path("./logs"),
        description="Directory for application logs"
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
    identity_mapping_encryption_key: Optional[str] = Field(
        default=None,
        description="32-byte hex key for identity mapping encryption"
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

    @field_validator('data_dir', 'prompt_dir', 'log_dir')
    @classmethod
    def ensure_path_exists(cls, v: Path) -> Path:
        """Create directories if they don't exist."""
        v = Path(v)
        v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator('identity_mapping_encryption_key')
    @classmethod
    def validate_encryption_key(cls, v: Optional[str]) -> Optional[str]:
        """Validate encryption key format if provided."""
        if v is None:
            return v
        if len(v) != 64:  # 32 bytes in hex = 64 characters
            raise ValueError("encryption_key must be 64 hex characters (32 bytes)")
        try:
            int(v, 16)  # Verify it's valid hex
        except ValueError:
            raise ValueError("encryption_key must be valid hexadecimal string")
        return v.lower()

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

    def get_csv_path(self, csv_name: str) -> Path:
        """Get full path for a CSV file."""
        return self.data_dir / csv_name

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

def get_data_dir() -> Path:
    """Get data directory path."""
    return get_settings().data_dir


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
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.prompt_dir.mkdir(parents=True, exist_ok=True)
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    # Create .gitkeep files if they don't exist
    (settings.data_dir / ".gitkeep").touch(exist_ok=True)
    (settings.log_dir / ".gitkeep").touch(exist_ok=True)


# Auto-initialize on import (only if .env exists)
if Path(".env").exists():
    try:
        _init_directories()
    except Exception:
        # Silently fail during import - will be caught when get_settings() is called
        pass
