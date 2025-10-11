#!/usr/bin/env python
"""ENIGMA Backend - Main Entry Point

This is the main entry point for the ENIGMA backend application.
Running this file will start the FastAPI server.

Usage:
    python main.py                  # Start in production mode
    python main.py --reload         # Start in development mode with auto-reload
    python main.py --port 8080      # Start on custom port
"""

import sys
import argparse
import uvicorn
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from src.config.settings import get_settings
from src.utils.logger import get_logger
from src.database.engine import verify_connection

logger = get_logger("main")


def check_prerequisites():
    """Check if all prerequisites are met before starting the server."""
    try:
        settings = get_settings()

        # Check if required environment variables are set
        if not settings.database_url:
            logger.error("DATABASE_URL is not set in .env file")
            return False

        if not settings.encryption_key:
            logger.error("ENCRYPTION_KEY is not set in .env file")
            return False

        if not settings.jwt_secret:
            logger.error("JWT_SECRET is not set in .env file")
            return False

        if not settings.openai_api_key:
            logger.warning("OPENAI_API_KEY is not set - LLM features will not work")

        # Test database connection
        logger.info("Verifying database connection...")
        if not verify_connection():
            logger.error("Failed to connect to database")
            logger.error("Please check your DATABASE_URL in .env file")
            return False

        logger.info("✅ Database connection successful")
        return True

    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        return False


def main():
    """Main entry point for the ENIGMA backend."""
    parser = argparse.ArgumentParser(
        description="ENIGMA Backend - AI-Powered Blind Merit Screening System"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )
    parser.add_argument(
        "--skip-checks",
        action="store_true",
        help="Skip prerequisite checks (not recommended)"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("ENIGMA Backend v2.0.0 - PostgreSQL Edition")
    print("AI-Powered Blind Merit Screening System")
    print("=" * 70)
    print()

    # Check prerequisites
    if not args.skip_checks:
        logger.info("Running prerequisite checks...")
        if not check_prerequisites():
            print()
            print("❌ Prerequisite checks failed!")
            print()
            print("Please ensure:")
            print("  1. Database is running (Supabase)")
            print("  2. .env file is configured with:")
            print("     - DATABASE_URL")
            print("     - ENCRYPTION_KEY")
            print("     - JWT_SECRET")
            print("     - OPENAI_API_KEY")
            print()
            print("Run 'python scripts/generate_keys.py' to generate keys")
            print("Run 'python scripts/init_db.py' to initialize database")
            print()
            return 1

    # Start server
    print()
    logger.info(f"Starting ENIGMA Backend on {args.host}:{args.port}")

    if args.reload:
        logger.info("Development mode: Auto-reload enabled")

    print()
    print(f"🚀 Server starting at http://{args.host}:{args.port}")
    print(f"📚 API Documentation: http://{args.host}:{args.port}/docs")
    print(f"🔍 Alternative docs: http://{args.host}:{args.port}/redoc")
    print()
    print("Press CTRL+C to stop the server")
    print("=" * 70)
    print()

    try:
        uvicorn.run(
            "api:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level="info"
        )
    except KeyboardInterrupt:
        print()
        print()
        print("=" * 70)
        logger.info("Server stopped by user")
        print("=" * 70)
        return 0
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
