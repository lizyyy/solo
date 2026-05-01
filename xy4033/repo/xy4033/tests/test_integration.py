import os
import shutil
import tempfile
from pathlib import Path

import pytest

from field_sync.config import SyncConfig
from field_sync.executor import Executor
from field_sync.journal import JournalManager
from field_sync.models import Manifest, SyncPlan
from field_sync.planner import PlanGenerator
from field_sync.reporter import Reporter
from field_sync.scanner import FileScanner


class TestFullWorkflow:
    @pytest.fixture
    def temp_dirs(self, tmp_path):
        left_dir = tmp_path / "work"
        right_dir = tmp_path / "backup"
        left_dir.mkdir()
        right_dir.mkdir()
        yield left_dir, right_dir
    
    def test_basic_sync_workflow(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=[],
        )
        
        file1 = left_dir / "photo.jpg"
        file1.write_text("photo content")
        
        file2 = left_dir / "points.csv"
        file2.write_text("id,lon,lat\n1,116.3,39.9")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        right_manifest = scanner.scan_right()
        
        assert len(left_manifest) == 2
        assert len(right_manifest) == 0
        
        generator = PlanGenerator(config)
        plan = generator.generate_plan(left_manifest, right_manifest)
        
        assert len(plan.operations) == 2
        assert len(plan.conflicts) == 0
        assert not plan.has_conflicts()
        
        executor = Executor(config, dry_run=False)
        journal, errors = executor.execute_plan(plan)
        
        assert len(errors) == 0
        assert len(journal.entries) == 2
        
        verify_errors = executor.verify_execution(journal)
        assert len(verify_errors) == 0
        
        right_files = list(right_dir.iterdir())
        assert len(right_files) == 2
        assert (right_dir / "photo.jpg").exists()
        assert (right_dir / "points.csv").exists()
        assert (right_dir / "photo.jpg").read_text() == "photo content"
    
    def test_conflict_detection(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=[],
        )
        
        left_file = left_dir / "test.txt"
        left_file.write_text("left version")
        
        right_file = right_dir / "test.txt"
        right_file.write_text("right version")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        right_manifest = scanner.scan_right()
        
        generator = PlanGenerator(config)
        plan = generator.generate_plan(left_manifest, right_manifest)
        
        assert plan.has_conflicts()
        assert len(plan.conflicts) >= 1
        
        conflict_types = [c.conflict_type for c in plan.conflicts]
        from field_sync.models import ConflictType
        assert ConflictType.SAME_PATH_DIFFERENT_CONTENT in conflict_types
    
    def test_case_conflict_detection(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=[],
        )
        
        left_file = left_dir / "Photo.JPG"
        left_file.write_text("test content")
        
        right_file = right_dir / "photo.jpg"
        right_file.write_text("test content")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        right_manifest = scanner.scan_right()
        
        generator = PlanGenerator(config)
        plan = generator.generate_plan(left_manifest, right_manifest)
        
        from field_sync.models import ConflictType
        conflict_types = [c.conflict_type for c in plan.conflicts]
        assert ConflictType.CASE_ONLY_DIFFERENCE in conflict_types
    
    def test_undo_operation(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=[],
        )
        
        left_file = left_dir / "test.txt"
        left_file.write_text("original content")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        right_manifest = scanner.scan_right()
        
        generator = PlanGenerator(config)
        plan = generator.generate_plan(left_manifest, right_manifest)
        
        executor = Executor(config, dry_run=False)
        journal, errors = executor.execute_plan(plan)
        
        assert (right_dir / "test.txt").exists()
        assert (right_dir / "test.txt").read_text() == "original content"
        
        journal_manager = JournalManager(config)
        successes, failures = journal_manager.undo_journal(journal, dry_run=False, force=False)
        
        assert len(successes) >= 1
        assert len(failures) == 0
        
        assert not (right_dir / "test.txt").exists()
    
    def test_report_generation(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=[],
        )
        
        (left_dir / "photo.jpg").write_text("photo")
        (left_dir / "data.csv").write_text("data")
        (right_dir / "old.txt").write_text("old")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        right_manifest = scanner.scan_right()
        
        reporter = Reporter(config)
        
        scan_report = reporter.generate_scan_report(
            left_manifest, right_manifest,
            left_manifest_path="",
            right_manifest_path="",
        )
        
        assert scan_report["report_type"] == "scan"
        assert scan_report["left"]["file_count"] == 2
        assert scan_report["right"]["file_count"] == 1
        
        generator = PlanGenerator(config)
        plan = generator.generate_plan(left_manifest, right_manifest)
        
        plan_report = reporter.generate_plan_report(plan)
        assert plan_report["report_type"] == "plan"
    
    def test_ignore_patterns(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=["*.tmp", "__pycache__", ".*"],
            allowed_extensions=[],
        )
        
        (left_dir / "photo.jpg").write_text("photo")
        (left_dir / "temp.tmp").write_text("temp")
        (left_dir / ".hidden").write_text("hidden")
        
        pycache = left_dir / "__pycache__"
        pycache.mkdir()
        (pycache / "module.pyc").write_text("cache")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        
        assert len(left_manifest) == 1
        assert left_manifest.get_by_path("photo.jpg") is not None
        
        for path in ["temp.tmp", ".hidden", "__pycache__/module.pyc"]:
            assert left_manifest.get_by_path(path) is None
    
    def test_extension_filtering(self, temp_dirs):
        left_dir, right_dir = temp_dirs
        
        config = SyncConfig(
            left_dir=str(left_dir),
            right_dir=str(right_dir),
            ignore_patterns=[],
            allowed_extensions=["jpg", "csv", "kml"],
        )
        
        (left_dir / "photo.jpg").write_text("photo")
        (left_dir / "data.csv").write_text("data")
        (left_dir / "route.kml").write_text("kml")
        (left_dir / "notes.txt").write_text("notes")
        (left_dir / "unknown.xyz").write_text("unknown")
        
        scanner = FileScanner(config)
        left_manifest = scanner.scan_left()
        
        assert len(left_manifest) == 3
        assert left_manifest.get_by_path("photo.jpg") is not None
        assert left_manifest.get_by_path("data.csv") is not None
        assert left_manifest.get_by_path("route.kml") is not None
        assert left_manifest.get_by_path("notes.txt") is None
        assert left_manifest.get_by_path("unknown.xyz") is None
