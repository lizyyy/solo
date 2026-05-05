"""Tests for the reporter module."""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from metaclass_analyzer.models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)
from metaclass_analyzer.reporter import JsonReporter, MarkdownReporter


class TestJsonReporter:
    """Tests for JsonReporter."""

    def test_generate_basic(self, sample_analysis_result):
        """Test generating basic JSON report."""
        json_str = JsonReporter.generate(sample_analysis_result)
        data = json.loads(json_str)

        assert "generated_at" in data
        assert "summary" in data
        assert "classes" in data
        assert "conflicts" in data
        assert "timeline" in data
        assert "errors" in data
        assert "warnings" in data
        assert "suggestions" in data

    def test_generate_summary(self, sample_analysis_result):
        """Test summary in JSON report."""
        json_str = JsonReporter.generate(sample_analysis_result)
        data = json.loads(json_str)

        summary = data["summary"]
        assert summary["total_classes"] == len(sample_analysis_result.classes)
        assert summary["total_events"] == len(sample_analysis_result.timeline)
        assert summary["conflicts_found"] == len(sample_analysis_result.conflicts)
        assert summary["errors_count"] == len(sample_analysis_result.errors)
        assert summary["warnings_count"] == len(sample_analysis_result.warnings)
        assert summary["suggestions_count"] == len(sample_analysis_result.suggestions)

    def test_generate_classes(self, sample_analysis_result):
        """Test classes in JSON report."""
        json_str = JsonReporter.generate(sample_analysis_result)
        data = json.loads(json_str)

        classes = data["classes"]
        for class_name, class_info in sample_analysis_result.classes.items():
            assert class_name in classes
            assert classes[class_name]["name"] == class_info.name
            assert classes[class_name]["metaclass"] == class_info.metaclass
            assert len(classes[class_name]["fields"]) == len(class_info.fields)

    def test_generate_conflicts(self, sample_analysis_result):
        """Test conflicts in JSON report."""
        json_str = JsonReporter.generate(sample_analysis_result)
        data = json.loads(json_str)

        conflicts = data["conflicts"]
        assert len(conflicts) == len(sample_analysis_result.conflicts)

        for i, conflict in enumerate(sample_analysis_result.conflicts):
            assert conflicts[i]["class_name"] == conflict.class_name
            assert conflicts[i]["bases"] == conflict.bases
            assert conflicts[i]["base_metaclasses"] == conflict.base_metaclasses
            assert conflicts[i]["resolution_steps"] == conflict.resolution_steps

    def test_generate_timeline(self, sample_analysis_result):
        """Test timeline in JSON report."""
        json_str = JsonReporter.generate(sample_analysis_result)
        data = json.loads(json_str)

        timeline = data["timeline"]
        assert len(timeline) == len(sample_analysis_result.timeline)

    def test_save(self, temp_dir, sample_analysis_result):
        """Test saving JSON report to file."""
        output_path = temp_dir / "report.json"
        JsonReporter.save(sample_analysis_result, str(output_path))

        assert output_path.exists()

        with open(output_path, "r") as f:
            data = json.load(f)

        assert "summary" in data

    def test_save_creates_parent_dirs(self, temp_dir, sample_analysis_result):
        """Test that save creates parent directories."""
        output_path = temp_dir / "nested" / "dir" / "report.json"
        JsonReporter.save(sample_analysis_result, str(output_path))

        assert output_path.exists()


class TestMarkdownReporter:
    """Tests for MarkdownReporter."""

    def test_generate_basic(self, sample_analysis_result):
        """Test generating basic Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "# Metaclass Analysis Report" in md_str
        assert "## Summary" in md_str
        assert "Generated at:" in md_str

    def test_generate_with_title(self, sample_analysis_result):
        """Test generating with custom title."""
        custom_title = "Custom Report Title"
        md_str = MarkdownReporter.generate(sample_analysis_result, title=custom_title)

        assert f"# {custom_title}" in md_str

    def test_generate_summary_table(self, sample_analysis_result):
        """Test summary table in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "| Metric | Count |" in md_str
        assert "| Total Classes |" in md_str
        assert "| Total Events |" in md_str
        assert "| Conflicts Found |" in md_str

    def test_generate_conflicts_section(self, sample_analysis_result):
        """Test conflicts section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Conflicts" in md_str
        for conflict in sample_analysis_result.conflicts:
            assert conflict.class_name in md_str
            assert "#### Resolution Steps:" in md_str

    def test_generate_errors_section(self, sample_analysis_result):
        """Test errors section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Errors" in md_str
        for error in sample_analysis_result.errors:
            assert error in md_str

    def test_generate_warnings_section(self, sample_analysis_result):
        """Test warnings section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Warnings" in md_str
        for warning in sample_analysis_result.warnings:
            assert warning in md_str

    def test_generate_suggestions_section(self, sample_analysis_result):
        """Test suggestions section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Suggestions" in md_str
        for suggestion in sample_analysis_result.suggestions:
            assert suggestion in md_str

    def test_generate_class_analysis_section(self, sample_analysis_result):
        """Test class analysis section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Class Analysis" in md_str
        for class_name in sample_analysis_result.classes:
            assert f"### {class_name}" in md_str

    def test_generate_fields_table(self, sample_analysis_result):
        """Test fields table in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "| Name | Order | Value | Descriptor | __set_name__ Called |" in md_str

    def test_generate_event_timeline_section(self, sample_analysis_result):
        """Test event timeline section in Markdown report."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Global Event Timeline" in md_str
        assert "| Time | Class | Event Type | Success | Details |" in md_str

    def test_generate_reference_section(self, sample_analysis_result):
        """Test metaclass mechanism reference section."""
        md_str = MarkdownReporter.generate(sample_analysis_result)

        assert "## Metaclass Mechanism Reference" in md_str
        assert "### Class Creation Flow" in md_str
        assert "__prepare__" in md_str
        assert "__new__" in md_str
        assert "__init__" in md_str
        assert "__set_name__" in md_str
        assert "__init_subclass__" in md_str
        assert "### Metaclass Conflict Resolution" in md_str

    def test_save(self, temp_dir, sample_analysis_result):
        """Test saving Markdown report to file."""
        output_path = temp_dir / "report.md"
        MarkdownReporter.save(sample_analysis_result, str(output_path))

        assert output_path.exists()

        with open(output_path, "r") as f:
            content = f.read()

        assert "# Metaclass Analysis Report" in content

    def test_save_with_custom_title(self, temp_dir, sample_analysis_result):
        """Test saving with custom title."""
        custom_title = "My Custom Report"
        output_path = temp_dir / "report.md"
        MarkdownReporter.save(sample_analysis_result, str(output_path), title=custom_title)

        with open(output_path, "r") as f:
            content = f.read()

        assert f"# {custom_title}" in content

    def test_save_creates_parent_dirs(self, temp_dir, sample_analysis_result):
        """Test that save creates parent directories."""
        output_path = temp_dir / "nested" / "dir" / "report.md"
        MarkdownReporter.save(sample_analysis_result, str(output_path))

        assert output_path.exists()
