"""Alembic environment configuration for SOC Assistant.

Key design decisions:
  - DATABASE_URL is read from the app's Settings (pydantic-settings), which
    reads from the .env file or environment variables — credentials are never
    hardcoded here.
  - The app uses asyncpg (postgresql+asyncpg://...) for the async FastAPI
    runtime.  Alembic requires a synchronous connection, so we swap the driver
    to psycopg2 (postgresql+psycopg2://...) automatically.
  - All four SQLAlchemy models are imported explicitly so that autogenerate
    sees the complete schema. If new models are added they must be imported
    here too.
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# Make sure the backend/ directory is on sys.path so that `import app.*`
# works regardless of where alembic is invoked from.
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# ---------------------------------------------------------------------------
# App imports — must come AFTER sys.path is patched.
# ---------------------------------------------------------------------------
# Settings reads DATABASE_URL from .env / environment.
from app.core.config import settings  # noqa: E402

# Base holds the SQLAlchemy metadata that autogenerate inspects.
from app.db.database import Base  # noqa: E402

# Import every model module so their classes register with Base.metadata.
# If you add a new model file, add its import here.
import app.db.models.alert  # noqa: E402, F401  (Alert, Analysis, Evidence, Feedback)

# ---------------------------------------------------------------------------
# Alembic config object.
# ---------------------------------------------------------------------------
config = context.config

# Set up Python logging from the ini file if available.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point autogenerate at our metadata.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Helper: convert an asyncpg URL to a psycopg2 URL for synchronous Alembic.
#
# postgresql+asyncpg://user:pass@host/db  →  postgresql+psycopg2://user:pass@host/db
# postgresql://user:pass@host/db          →  unchanged (already sync)
# ---------------------------------------------------------------------------
def _sync_url(url: str) -> str:
    """Return a synchronous-driver variant of the DATABASE_URL."""
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)


def _get_url() -> str:
    """Resolve the database URL, preferring the ini file override if set."""
    # Allow the ini file's sqlalchemy.url to override (useful for CI or manual
    # invocations), but fall back to the app's settings.
    ini_url = config.get_main_option("sqlalchemy.url")
    raw_url = ini_url if ini_url else settings.DATABASE_URL
    return _sync_url(raw_url)


# ---------------------------------------------------------------------------
# Offline mode: emit raw SQL without connecting to the database.
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without a live DB)."""
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Emit 'CREATE INDEX IF NOT EXISTS' style DDL where supported.
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode: connect to the database and apply migrations.
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode (applies migrations to a live DB)."""
    # Build a temporary config dict so we can inject the resolved URL.
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Detect column type changes (e.g., String → DateTime) during
            # future autogenerate runs.
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
