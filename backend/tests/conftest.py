"""Shared pytest fixtures and environment setup.

The Settings class requires DATABASE_URL at import time, so tests set a
default before app imports run. A real database is NOT required for unit
tests: external services are mocked (spec section 31).
"""
import os

# Must be set before app.core.config is imported by any test module.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/soc_test"
)

import pytest  # noqa: E402
