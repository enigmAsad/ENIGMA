"""Database engine and session management for ENIGMA backend."""

from sqlalchemy import create_engine, event, pool
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Generator
from contextlib import contextmanager

from src.config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("database")


def get_engine():
    """Create and configure SQLAlchemy engine with connection pooling.

    Configured for Supabase transaction pooler with:
    - QueuePool for connection management
    - Pool size of 20 connections (configurable)
    - No overflow to maintain predictable load
    - 30-second connection timeout

    Returns:
        Engine: Configured SQLAlchemy engine
    """
    settings = get_settings()

    # For Supabase transaction pooler, use simpler configuration
    engine = create_engine(
        settings.database_url,
        poolclass=QueuePool,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        pool_pre_ping=True,  # Verify connections before using
        echo=settings.database_echo,  # Log SQL statements (for debugging)
        # Remove connect_args for Supabase transaction pooler compatibility
    )

    # Log pool status on checkout (for monitoring)
    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_conn, connection_record):
        """Log successful database connections."""
        logger.debug("Database connection established")

    @event.listens_for(engine, "checkout")
    def receive_checkout(dbapi_conn, connection_record, connection_proxy):
        """Log connection pool checkout."""
        pool_status = engine.pool.status()
        logger.debug(f"Connection checked out from pool. Status: {pool_status}")

    logger.info(
        f"Database engine initialized: pool_size={settings.database_pool_size}, "
        f"max_overflow={settings.database_max_overflow}"
    )

    return engine


# Create global engine instance
engine = get_engine()

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Prevent lazy loading issues after commit
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions.

    Usage in FastAPI routes:
        @app.get("/endpoint")
        def my_route(db: Session = Depends(get_db)):
            # Use db session here
            pass

    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for database sessions (for non-FastAPI usage).

    Usage:
        with get_db_context() as db:
            # Use db session here
            result = db.query(Model).filter(...).first()

    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        logger.error(f"Database transaction error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Initialize database by creating all tables.

    This should be called once during application setup.
    In production, use Alembic migrations instead.
    """
    from src.database.base import Base
    from src.database import models  # noqa: F401 - Import to register models

    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def drop_db():
    """Drop all database tables.

    WARNING: This will delete all data. Use with caution.
    Only for development/testing purposes.
    """
    from src.database.base import Base
    from src.database import models  # noqa: F401 - Import to register models

    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("All database tables dropped")


def verify_connection():
    """Verify database connection is working.

    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        with engine.connect() as conn:
            # Use text() for proper SQL execution with Supabase
            from sqlalchemy import text
            result = conn.execute(text("SELECT 1"))
            result.fetchone()  # Consume the result
        logger.info("Database connection verified successfully")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


def get_pool_status() -> dict:
    """Get current connection pool status.

    Returns:
        dict: Pool status with size, checked_in, checked_out, overflow
    """
    status = engine.pool.status()
    logger.debug(f"Connection pool status: {status}")
    return {
        "pool_size": engine.pool.size(),
        "checked_in": engine.pool.checkedin(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "status_str": status
    }
