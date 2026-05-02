import pytest

from md_validator.parser import parse_markdown, parse_markdown_files
from md_validator.executor import check_env_vars
from md_validator.snapshot import compare_snapshot, read_snapshot, write_snapshot


def test_parse_markdown_basic():
    content = """```python test:block1
print("hello")
```"""
    blocks = parse_markdown(content, "test.md")
    assert len(blocks) == 1
    assert blocks[0].id == "test:block1"
    assert blocks[0].language == "python"
    assert blocks[0].code == 'print("hello")'


def test_parse_markdown_with_env():
    content = """```bash test:block2 env:MY_VAR
echo $MY_VAR
```"""
    blocks = parse_markdown(content, "test.md")
    assert len(blocks) == 1
    assert blocks[0].id == "test:block2"
    assert blocks[0].language == "bash"
    assert blocks[0].env_vars == ["MY_VAR"]


def test_parse_markdown_multiple_blocks():
    content = """```python test:a
print(1)
```

```bash test:b
echo hello
```"""
    blocks = parse_markdown(content, "test.md")
    assert len(blocks) == 2
    assert blocks[0].id == "test:a"
    assert blocks[1].id == "test:b"


def test_check_env_vars_missing():
    result = check_env_vars(["NON_EXISTENT_VAR_12345"])
    assert result == "NON_EXISTENT_VAR_12345"


def test_check_env_vars_exists():
    import os
    os.environ["TEST_EXISTS_VAR"] = "value"
    result = check_env_vars(["TEST_EXISTS_VAR"])
    assert result is None


def test_parse_markdown_files(tmp_path):
    md_file = tmp_path / "test.md"
    md_file.write_text("""```python test:file_block
print("test")
```""")
    
    blocks = parse_markdown_files(str(tmp_path))
    assert len(blocks) == 1
    assert blocks[0].id == "test:file_block"
    assert "test.md" in blocks[0].file_path