import json
import tempfile
from pathlib import Path

import pytest

from asyncio_diagnose.analyzer import AsyncioAnalyzer
from asyncio_diagnose.importer import DataImporter
from asyncio_diagnose.reporter import ReportGenerator


class TestReportGenerator:
    def test_generate_markdown(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        markdown = ReportGenerator.generate_markdown(result, importer)
        
        assert isinstance(markdown, str)
        assert "# Asyncio 诊断报告" in markdown
        assert "## 摘要" in markdown

    def test_generate_json(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        json_output = ReportGenerator.generate_json(result, importer)
        
        assert isinstance(json_output, str)
        parsed = json.loads(json_output)
        assert "summary" in parsed
        assert "all_tasks" in parsed
        assert "generated_at" in parsed

    def test_export_markdown(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            output_path = Path(f.name)
        
        ReportGenerator.export_markdown(result, importer, output_path)
        
        assert output_path.exists()
        content = output_path.read_text()
        assert "# Asyncio 诊断报告" in content
        
        output_path.unlink()

    def test_export_json(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            output_path = Path(f.name)
        
        ReportGenerator.export_json(result, importer, output_path)
        
        assert output_path.exists()
        content = output_path.read_text()
        parsed = json.loads(content)
        assert "summary" in parsed
        
        output_path.unlink()

    def test_generate_markdown_with_issues(self, temp_task_dump, sample_leak_tasks):
        file_path = temp_task_dump(sample_leak_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        markdown = ReportGenerator.generate_markdown(result, importer)
        
        assert "## 任务泄漏" in markdown

    def test_generate_json_contains_all_fields(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        json_output = ReportGenerator.generate_json(result, importer)
        parsed = json.loads(json_output)
        
        expected_fields = [
            "summary",
            "long_pending_tasks",
            "task_leaks",
            "ineffective_cancellations",
            "timeout_chains",
            "queue_congestion",
            "wait_chains",
            "all_tasks",
            "generated_at"
        ]
        
        for field in expected_fields:
            assert field in parsed

    def test_task_to_dict(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis()
        
        json_output = ReportGenerator.generate_json(result, importer)
        parsed = json.loads(json_output)
        
        all_tasks = parsed["all_tasks"]
        assert len(all_tasks) == 3
        
        for task in all_tasks:
            assert "task_id" in task
            assert "state" in task
            assert "coro_name" in task
            assert "created_at" in task
