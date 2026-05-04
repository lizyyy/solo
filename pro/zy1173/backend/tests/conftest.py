import pytest
from pathlib import Path
import tempfile
import shutil


@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def test_texts():
    return {
        "english": "Hello world! This is a test.",
        "chinese": "你好世界！这是一个测试。",
        "mixed": "GPT 是 Generative Pre-trained Transformer 的缩写。",
        "empty": "",
        "whitespace": "   \n\t\n   ",
        "long": "这是一段很长的文本。" * 20,
        "special": "!@#$%^&*()_+",
    }
