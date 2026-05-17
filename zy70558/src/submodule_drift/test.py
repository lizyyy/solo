from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest import TestCase

from .git_metadata import GitMetadataReader, SubmoduleInfo, ParseError
from .drift_detector import DriftDetector, DriftResult
from .report_generator import ReportGenerator


class TestSubmoduleInfo(TestCase):
    def test_submodule_info_creation(self):
        sm = SubmoduleInfo(
            name="test-module",
            path="lib/test",
            url="https://github.com/test/test.git",
            branch="main"
        )
        self.assertEqual(sm.name, "test-module")
        self.assertEqual(sm.path, "lib/test")
        self.assertEqual(sm.url, "https://github.com/test/test.git")
        self.assertEqual(sm.branch, "main")

    def test_submodule_info_defaults(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        self.assertIsNone(sm.branch)
        self.assertIsNone(sm.expected_commit)
        self.assertIsNone(sm.actual_commit)
        self.assertEqual(sm.errors, [])
        self.assertEqual(sm.raw_lines, [])


class TestGitMetadataReader(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_path = Path(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_parse_no_gitmodules_file(self):
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        self.assertEqual(len(result.submodules), 0)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0]["type"], "file_missing")

    def test_parse_empty_gitmodules(self):
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text("")
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        self.assertEqual(len(result.submodules), 0)

    def test_parse_valid_submodule(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    branch = main
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 1)
        sm = result.submodules[0]
        self.assertEqual(sm.name, "module1")
        self.assertEqual(sm.path, "lib/module1")
        self.assertEqual(sm.url, "https://github.com/example/module1.git")
        self.assertEqual(sm.branch, "main")
        self.assertEqual(len(sm.errors), 0)

    def test_parse_multiple_submodules(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
[submodule "module2"]
    path = lib/module2
    url = https://github.com/example/module2.git
    branch = develop
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 2)
        names = {sm.name for sm in result.submodules}
        self.assertEqual(names, {"module1", "module2"})

    def test_parse_orphan_line_outside_section(self):
        gitmodules_content = """orphan_property = value
[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0]["type"], "orphan_line")
        self.assertEqual(result.errors[0]["line_number"], 1)

    def test_parse_missing_path(self):
        gitmodules_content = """[submodule "module1"]
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "missing_path")

    def test_parse_missing_url(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "missing_url")

    def test_parse_unknown_field(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    unknown_field = value
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "unknown_field")
        self.assertEqual(sm.errors[0]["line_number"], 4)

    def test_parse_preserves_raw_lines(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertGreater(len(sm.raw_lines), 0)
        line_numbers = {line["line_number"] for line in sm.raw_lines}
        self.assertEqual(line_numbers, {1, 2, 3})

    def test_parse_with_comments_and_empty_lines(self):
        gitmodules_content = """# This is a comment
[submodule "module1"]
    path = lib/module1
    # inline comment
    url = https://github.com/example/module1.git

"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 1)
        sm = result.submodules[0]
        self.assertEqual(sm.path, "lib/module1")
        self.assertEqual(sm.url, "https://github.com/example/module1.git")


class TestDriftDetector(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_path = Path(self.temp_dir)
        self.detector = DriftDetector(self.repo_path)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_detect_drift_empty_list(self):
        results = self.detector.detect_drift([])
        self.assertEqual(len(results), 0)

    def test_detect_drift_missing_submodule(self):
        sm = SubmoduleInfo(
            name="missing-module",
            path="nonexistent/path",
            url="https://github.com/test/test.git"
        )
        
        results = self.detector.detect_drift([sm])
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].is_missing)
        # Missing submodules are marked as errors in the error list, may not always set has_drift
        self.assertGreater(len(results[0].errors), 0)

    def test_detect_result_preserves_errors(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        sm.errors.append({
            "type": "test_error",
            "message": "Test error message",
            "line_number": 5
        })
        
        results = self.detector.detect_drift([sm])
        self.assertGreater(len(results[0].errors), 0)
        error_types = {e["type"] for e in results[0].errors}
        self.assertIn("test_error", error_types)

    def test_detect_result_preserves_raw_context(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        sm.raw_lines.append({
            "line_number": 1,
            "content": '[submodule "test"]',
            "field": "section"
        })
        
        results = self.detector.detect_drift([sm])
        self.assertIn("raw_lines", results[0].raw_context)
        self.assertGreater(len(results[0].raw_context["raw_lines"]), 0)


class TestReportGenerator(TestCase):
    def setUp(self):
        self.generator = ReportGenerator()

    def _create_test_result(self, name="test-module", has_drift=False, is_missing=False):
        sm = SubmoduleInfo(
            name=name,
            path=f"lib/{name}",
            url=f"https://github.com/test/{name}.git",
            branch="main",
            expected_commit="abc123def4567890",
            actual_commit="abc123def4567890" if not has_drift else "def789abc0123456"
        )
        return DriftResult(
            submodule=sm,
            has_drift=has_drift,
            is_missing=is_missing,
            commits_ahead=1 if has_drift else 0,
            commits_behind=2 if has_drift else 0,
            drift_type="diverged" if has_drift else None
        )

    def test_generate_json(self):
        results = [self._create_test_result()]
        json_output = self.generator.generate_json(results)
        
        self.assertIsInstance(json_output, str)
        self.assertIn("generated_at", json_output)
        self.assertIn("results", json_output)
        self.assertIn("test-module", json_output)

    def test_generate_json_with_errors(self):
        result = self._create_test_result()
        result.errors.append({
            "type": "test_error",
            "message": "Test error",
            "line_number": 5
        })
        
        json_output = self.generator.generate_json([result])
        self.assertIn("errors", json_output)
        self.assertIn("test_error", json_output)

    def test_generate_markdown(self):
        results = [self._create_test_result()]
        md_output = self.generator.generate_markdown(results)
        
        self.assertIsInstance(md_output, str)
        self.assertIn("# Git Submodule Drift Detection Report", md_output)
        self.assertIn("## Summary", md_output)
        self.assertIn("## Detailed Results", md_output)

    def test_generate_markdown_with_errors(self):
        result = self._create_test_result()
        result.errors.append({
            "type": "parse_error",
            "message": "Test parse error",
            "line_number": 10
        })
        
        md_output = self.generator.generate_markdown([result])
        self.assertIn("## Errors Found", md_output)
        self.assertIn("parse_error", md_output)

    def test_build_summary(self):
        results = [
            self._create_test_result("ok1"),
            self._create_test_result("drift1", has_drift=True),
            self._create_test_result("missing1", is_missing=True)
        ]
        results[1].errors.append({"type": "error1", "message": "test"})
        
        summary = self.generator._build_summary(results)
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["ok"], 1)
        self.assertEqual(summary["drifted"], 1)
        self.assertEqual(summary["missing"], 1)
        self.assertEqual(summary["with_errors"], 1)

    def test_generate_team_email_content(self):
        results = [
            self._create_test_result("ok1"),
            self._create_test_result("drift1", has_drift=True),
            self._create_test_result("missing1", is_missing=True)
        ]
        
        email = self.generator.generate_team_email_content(results)
        self.assertIn("Hi Team", email)
        self.assertIn("Submodules with Commit Drift", email)
        self.assertIn("Missing Submodules", email)
        self.assertIn("Action Items", email)


if __name__ == "__main__":
    import unittest
    unittest.main()
