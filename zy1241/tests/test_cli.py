"""测试命令行接口"""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from magic_method_analyzer.cli import main


class TestCLI:
    """测试 CLI 命令"""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def sample_jsonl(self, tmp_path: Path):
        content = '\n'.join([
            json.dumps({
                "method": "__getattribute__",
                "timestamp": "2026-05-05T10:00:00.000",
                "caller": "test",
                "target": "obj1",
                "args": ["attr"],
                "kwargs": {},
                "result": "value"
            }),
            json.dumps({
                "method": "__enter__",
                "timestamp": "2026-05-05T10:00:00.001",
                "caller": "test",
                "target": "resource1",
                "args": [],
                "kwargs": {},
                "result": "resource1"
            }),
            json.dumps({
                "method": "__exit__",
                "timestamp": "2026-05-05T10:00:00.002",
                "caller": "test",
                "target": "resource1",
                "args": ["ValueError", "test error", "traceback"],
                "kwargs": {},
                "result": True
            }),
        ])
        file = tmp_path / "events.jsonl"
        file.write_text(content)
        return file

    @pytest.fixture
    def sample_yaml(self, tmp_path: Path):
        content = """
cases:
  - id: case_001
    name: 测试用例
    category: test
    description: 测试描述
    expected_behavior: []
    code_snippet: "pass"
"""
        file = tmp_path / "magic-cases.yaml"
        file.write_text(content)
        return file

    @pytest.fixture
    def sample_snippets(self, tmp_path: Path):
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text("""
class TestClass:
    def __init__(self):
        pass
    
    def __getattr__(self, name):
        return name
    
    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)
""")
        return snippets_dir

    def test_help_command(self, runner: CliRunner):
        result = runner.invoke(main, ["--help"])
        assert result.exit_code == 0
        assert "魔术方法调用顺序分析工具" in result.output

    def test_version_command(self, runner: CliRunner):
        result = runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "mmanalyzer" in result.output

    def test_analyze_with_jsonl(self, runner: CliRunner, sample_jsonl: Path, tmp_path: Path):
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(main, [
                "analyze",
                "--jsonl", str(sample_jsonl),
                "--no-save",
            ])
            assert result.exit_code == 0
            assert "开始分析魔术方法调用" in result.output
            assert "方法调用统计" in result.output

    def test_analyze_with_yaml(self, runner: CliRunner, sample_yaml: Path, tmp_path: Path):
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(main, [
                "analyze",
                "--yaml", str(sample_yaml),
                "--no-save",
            ])
            assert result.exit_code == 0
            assert "解析 YAML 用例文件" in result.output
            assert "加载了 1 个测试用例" in result.output

    def test_analyze_with_snippets(self, runner: CliRunner, sample_snippets: Path, tmp_path: Path):
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(main, [
                "analyze",
                "--snippets", str(sample_snippets),
                "--no-save",
            ])
            assert result.exit_code == 0
            assert "解析代码片段目录" in result.output
            assert "加载了 1 个代码片段" in result.output

    def test_analyze_export_markdown(self, runner: CliRunner, sample_jsonl: Path, tmp_path: Path):
        output_file = tmp_path / "report.md"
        
        result = runner.invoke(main, [
            "analyze",
            "--jsonl", str(sample_jsonl),
            "--no-save",
            "--output", str(output_file),
            "--format", "markdown",
        ])
        
        assert result.exit_code == 0
        assert output_file.exists()
        
        content = output_file.read_text(encoding="utf-8")
        assert "# 魔术方法分析报告" in content
        assert "__getattribute__" in content

    def test_analyze_export_json(self, runner: CliRunner, sample_jsonl: Path, tmp_path: Path):
        output_file = tmp_path / "report.json"
        
        result = runner.invoke(main, [
            "analyze",
            "--jsonl", str(sample_jsonl),
            "--no-save",
            "--output", str(output_file),
            "--format", "json",
        ])
        
        assert result.exit_code == 0
        assert output_file.exists()
        
        content = json.loads(output_file.read_text(encoding="utf-8"))
        assert "session_id" in content
        assert "summary" in content

    def test_analyze_detects_issues(self, runner: CliRunner, sample_jsonl: Path, tmp_path: Path):
        with runner.isolated_filesystem(temp_dir=tmp_path):
            result = runner.invoke(main, [
                "analyze",
                "--jsonl", str(sample_jsonl),
                "--no-save",
            ])
            
            assert result.exit_code == 0
            assert "发现" in result.output and "个问题" in result.output

    def test_validate_yaml_valid(self, runner: CliRunner, sample_yaml: Path):
        result = runner.invoke(main, [
            "validate",
            "--yaml", str(sample_yaml),
        ])
        assert result.exit_code == 0
        assert "✓ 文件格式有效" in result.output or "文件格式有效" in result.output

    def test_validate_jsonl_valid(self, runner: CliRunner, sample_jsonl: Path):
        result = runner.invoke(main, [
            "validate",
            "--jsonl", str(sample_jsonl),
        ])
        assert result.exit_code == 0

    def test_validate_snippet_valid(self, runner: CliRunner, sample_snippets: Path):
        test_file = sample_snippets / "test.py"
        result = runner.invoke(main, [
            "validate",
            "--snippet", str(test_file),
        ])
        assert result.exit_code == 0
        assert "✓ 语法正确" in result.output or "语法正确" in result.output

    def test_validate_yaml_invalid(self, runner: CliRunner, tmp_path: Path):
        invalid_yaml = tmp_path / "invalid.yaml"
        invalid_yaml.write_text("invalid: [yaml")
        
        result = runner.invoke(main, [
            "validate",
            "--yaml", str(invalid_yaml),
        ])
        assert result.exit_code == 0
        assert "错误" in result.output.lower() or "语法错误" in result.output

    def test_export_list_empty(self, runner: CliRunner, tmp_path: Path):
        db_path = tmp_path / "empty.db"
        
        with patch.dict('os.environ', {'MMA_DB_PATH': str(db_path)}):
            result = runner.invoke(main, [
                "export",
                "--list",
            ])
            assert result.exit_code == 0
            assert "会话列表" in result.output

    def test_export_stats_empty(self, runner: CliRunner, tmp_path: Path):
        db_path = tmp_path / "empty.db"
        
        with patch.dict('os.environ', {'MMA_DB_PATH': str(db_path)}):
            result = runner.invoke(main, [
                "export",
                "--stats",
            ])
            assert result.exit_code == 0
            assert "数据库统计" in result.output

    def test_compare_nonexistent_sessions(self, runner: CliRunner, tmp_path: Path):
        db_path = tmp_path / "test.db"
        
        with patch.dict('os.environ', {'MMA_DB_PATH': str(db_path)}):
            result = runner.invoke(main, [
                "compare",
                "nonexistent1",
                "nonexistent2",
            ])
            assert result.exit_code == 1
            assert "会话不存在" in result.output
