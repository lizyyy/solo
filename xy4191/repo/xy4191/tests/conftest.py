import os
import sys
import tempfile
from pathlib import Path

import pytest

project_root = Path(__file__).parent.parent
src_dir = project_root / "src"
sys.path.insert(0, str(src_dir))


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


@pytest.fixture
def test_file(temp_dir):
    test_path = temp_dir / "test.txt"
    test_path.write_text("Hello, World!")
    return test_path


@pytest.fixture
def sample_good_release():
    return Path(__file__).parent.parent / "examples" / "good_release"


@pytest.fixture
def sample_bad_release():
    return Path(__file__).parent.parent / "examples" / "bad_release"
