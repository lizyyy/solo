from pathlib import Path

import pytest

from release_validator.reporter import Reporter


class TestReporter:
    def test_init(self, temp_dir):
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        assert reporter.output_dir == output_dir
        assert reporter.generated_at is not None
    
    def test_init_default_dir(self):
        reporter = Reporter()
        
        assert reporter.output_dir is not None
    
    def test_export_markdown(self, temp_dir):
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {
            "title": "Test Report",
            "summary": {
                "total_files": 2,
                "total_issues": 1,
                "passed": False,
            },
            "files": [
                {
                    "filename": "test.tar.gz",
                    "file_type": "tar",
                    "size": 1000,
                    "sha256": "abc123",
                    "version": "1.0.0",
                }
            ],
            "issues": [
                {
                    "severity": "high",
                    "rule_name": "Hash Verification",
                    "message": "Hash mismatch",
                    "file": "test.tar.gz",
                }
            ],
        }
        
        md_path = reporter.export_markdown(test_data)
        
        assert md_path.exists()
        assert md_path.suffix == ".md"
        assert md_path.parent == output_dir
        
        content = md_path.read_text()
        assert "Test Report" in content
        assert "test.tar.gz" in content
        assert "Hash Verification" in content
    
    def test_export_csv(self, temp_dir):
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {
            "issues": [
                {
                    "severity": "high",
                    "rule_id": "hash-verification",
                    "rule_name": "Hash Check",
                    "message": "Hash mismatch",
                    "file": "test.tar.gz",
                    "line": 1,
                    "expected": "abc123",
                    "actual": "def456",
                }
            ],
        }
        
        csv_path = reporter.export_csv(test_data)
        
        assert csv_path.exists()
        assert csv_path.suffix == ".csv"
        assert csv_path.parent == output_dir
        
        content = csv_path.read_text()
        assert "Hash Check" in content
        assert "test.tar.gz" in content
        assert "abc123" in content
        assert "def456" in content
    
    def test_export_json(self, temp_dir):
        import json
        
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {
            "title": "Test Report",
            "summary": {"total_files": 1},
            "custom_field": "custom_value",
        }
        
        json_path = reporter.export_json(test_data)
        
        assert json_path.exists()
        assert json_path.suffix == ".json"
        assert json_path.parent == output_dir
        
        with open(json_path, 'r') as f:
            content = json.load(f)
        
        assert content["title"] == "Test Report"
        assert content["custom_field"] == "custom_value"
        assert "generated_at" in content
        assert "tool" in content
    
    def test_generate_all(self, temp_dir):
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {
            "title": "Test Report",
            "summary": {"total_files": 1},
            "issues": [],
        }
        
        outputs = reporter.generate_all(test_data)
        
        assert "markdown" in outputs
        assert "csv" in outputs
        assert "json" in outputs
        
        for path in outputs.values():
            assert path.exists()
    
    def test_generate_all_with_specific_formats(self, temp_dir):
        output_dir = temp_dir / "reports"
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {
            "title": "Test Report",
            "summary": {"total_files": 1},
            "issues": [],
        }
        
        outputs = reporter.generate_all(test_data, formats=["json"])
        
        assert "json" in outputs
        assert "markdown" not in outputs
        assert "csv" not in outputs
    
    def test_output_dir_creation(self, temp_dir):
        output_dir = temp_dir / "non_existent_dir" / "reports"
        
        reporter = Reporter(output_dir=output_dir)
        
        test_data = {"title": "Test", "summary": {}, "issues": []}
        reporter.export_json(test_data)
        
        assert output_dir.exists()
