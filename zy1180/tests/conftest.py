"""Test fixtures for pytest."""

import pytest
from pathlib import Path


@pytest.fixture
def test_data_dir() -> Path:
    """Return path to test data directory."""
    return Path(__file__).parent.parent / "test_data"


@pytest.fixture
def examples_dir() -> Path:
    """Return path to examples directory."""
    return Path(__file__).parent.parent / "examples"


@pytest.fixture
def bad_migrations_dir(test_data_dir: Path) -> Path:
    """Return path to bad migrations directory."""
    return test_data_dir / "bad_migrations"
