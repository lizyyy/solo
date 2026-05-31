from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest

from dep_license.models import (
    LicenseEntry,
    RollbackRecord,
    DirectorySnapshot,
    FileSnapshot,
    RunRecord,
    RunStatus,
    ConfigChangeRecord,
    EvidenceRef,
    EvidenceType,
    DuplicateExecutionIssue,
)
from dep_license.scanner import DependencyScanner
from dep_license.snapshot import SnapshotManager
from dep_license.history import HistoryManager
from dep_license.rollback import RollbackTracker
from dep_license.config_audit import ConfigAuditManager
from dep_license.reporter import Reporter


class TestModels(unittest.TestCase):
    def test_license_entry_auto_id(self):
        entry = LicenseEntry(package_name="lodash", version="4.17.21", license_type="MIT")
        self.assertTrue(entry.entry_id)
        self.assertEqual(entry.package_name, "lodash")

    def test_license_entry_roundtrip(self):
        entry = LicenseEntry(
            package_name="react",
            version="18.0.0",
            license_type="MIT",
            source_file="package.json",
            evidence_refs=[
                EvidenceRef(EvidenceType.DIRECTORY_SNAPSHOT, "snap001", "test detail")
            ],
        )
        d = entry.to_dict()
        restored = LicenseEntry.from_dict(d)
        self.assertEqual(restored.package_name, entry.package_name)
        self.assertEqual(restored.version, entry.version)
        self.assertEqual(len(restored.evidence_refs), 1)
        self.assertEqual(restored.evidence_refs[0].evidence_type, EvidenceType.DIRECTORY_SNAPSHOT)

    def test_rollback_record_roundtrip(self):
        record = RollbackRecord(
            record_id="",
            target_package="express",
            target_version="4.17.0",
            previous_version="4.18.0",
            reason="安全漏洞",
            operator="张三",
        )
        d = record.to_dict()
        restored = RollbackRecord.from_dict(d)
        self.assertEqual(restored.target_package, "express")
        self.assertEqual(restored.operator, "张三")

    def test_directory_snapshot_roundtrip(self):
        snap = DirectorySnapshot(
            base_path="/tmp/project",
            files=[FileSnapshot(path="package.json", content_hash="abc123", content="{}")],
            label="test_snap",
        )
        d = snap.to_dict()
        restored = DirectorySnapshot.from_dict(d)
        self.assertEqual(restored.base_path, "/tmp/project")
        self.assertEqual(len(restored.files), 1)

    def test_run_record_roundtrip(self):
        run = RunRecord(
            run_id="",
            status=RunStatus.SUCCESS,
            entries=[LicenseEntry("pkg", "1.0.0", "MIT")],
            issues=[],
            snapshot_id="snap001",
            rollback_ids=["rb001"],
        )
        d = run.to_dict()
        restored = RunRecord.from_dict(d)
        self.assertEqual(restored.status, RunStatus.SUCCESS)
        self.assertEqual(len(restored.entries), 1)
        self.assertEqual(restored.rollback_ids, ["rb001"])


class TestScanner(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.scanner = DependencyScanner(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_scan_package_json(self):
        pkg = {
            "dependencies": {"lodash": "^4.17.21", "express": "~4.18.0"},
            "devDependencies": {"jest": "^29.0.0"},
        }
        with open(os.path.join(self.tmpdir, "package.json"), "w") as f:
            json.dump(pkg, f)

        entries = self.scanner.scan(snapshot_id="snap001")
        names = [e.package_name for e in entries]
        self.assertIn("lodash", names)
        self.assertIn("express", names)
        self.assertIn("jest", names)
        for e in entries:
            self.assertEqual(e.source_file, "package.json")
            self.assertTrue(any(r.record_id == "snap001" for r in e.evidence_refs))

    def test_scan_requirements_txt(self):
        with open(os.path.join(self.tmpdir, "requirements.txt"), "w") as f:
            f.write("flask==2.3.0\nrequests>=2.28.0\n# comment\n")

        entries = self.scanner.scan(snapshot_id="snap002")
        names = [e.package_name for e in entries]
        self.assertIn("flask", names)
        self.assertIn("requests", names)
        for e in entries:
            if e.package_name in ("flask", "requests"):
                self.assertEqual(e.source_file, "requirements.txt")

    def test_scan_empty_dir(self):
        entries = self.scanner.scan()
        self.assertEqual(len(entries), 0)


class TestSnapshotManager(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.store_dir = tempfile.mkdtemp()
        self.manager = SnapshotManager(self.store_dir)
        self.project_dir = os.path.join(self.tmpdir, "project")
        os.makedirs(self.project_dir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        shutil.rmtree(self.store_dir, ignore_errors=True)

    def test_take_and_get_snapshot(self):
        with open(os.path.join(self.project_dir, "package.json"), "w") as f:
            json.dump({"name": "test"}, f)

        snap = self.manager.take_snapshot(self.project_dir, label="initial")
        self.assertTrue(snap.snapshot_id)
        self.assertGreater(len(snap.files), 0)

        retrieved = self.manager.get_snapshot(snap.snapshot_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.snapshot_id, snap.snapshot_id)

    def test_compare_snapshots(self):
        with open(os.path.join(self.project_dir, "a.txt"), "w") as f:
            f.write("version1")

        snap1 = self.manager.take_snapshot(self.project_dir, label="v1")

        with open(os.path.join(self.project_dir, "a.txt"), "w") as f:
            f.write("version2")
        with open(os.path.join(self.project_dir, "b.txt"), "w") as f:
            f.write("new_file")

        snap2 = self.manager.take_snapshot(self.project_dir, label="v2")

        diff = self.manager.compare_snapshots(snap1.snapshot_id, snap2.snapshot_id)
        self.assertIn("modified", diff)
        self.assertIn("added", diff)


class TestHistoryIdempotency(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.history = HistoryManager(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_same_materials_returns_historical(self):
        entries = [
            LicenseEntry("pkg-a", "1.0.0", "MIT"),
            LicenseEntry("pkg-b", "2.0.0", "Apache-2.0"),
        ]

        run1 = self.history.record_run(entries, snapshot_id="snap001", operator="张三")
        self.assertEqual(run1.status, RunStatus.SUCCESS)

        run2 = self.history.record_run(entries, snapshot_id="snap001", operator="李四")
        self.assertTrue(run2.is_historical)
        self.assertEqual(run2.status, RunStatus.SUCCESS)

        self.assertEqual(run1.run_id, run2.run_id)

    def test_duplicate_with_license_change(self):
        entries_v1 = [LicenseEntry("pkg-a", "1.0.0", "MIT")]
        run1 = self.history.record_run(entries_v1, snapshot_id="snap001")
        self.assertEqual(run1.status, RunStatus.SUCCESS)

        entries_v2 = [LicenseEntry("pkg-a", "1.0.0", "GPL")]
        run2 = self.history.record_run(entries_v2, snapshot_id="snap002", rollback_ids=[])
        self.assertEqual(run2.status, RunStatus.DUPLICATE_OVERRIDE)
        self.assertGreater(len(run2.issues), 0)

        issue = run2.issues[0]
        self.assertEqual(issue.evidence_source, EvidenceType.DIRECTORY_SNAPSHOT)
        self.assertIn("目录快照", issue.description)

    def test_duplicate_with_rollback_evidence(self):
        entries_v1 = [LicenseEntry("pkg-a", "1.0.0", "MIT")]
        self.history.record_run(entries_v1, snapshot_id="snap001")

        entries_v2 = [LicenseEntry("pkg-a", "1.0.0", "GPL")]
        run2 = self.history.record_run(
            entries_v2, snapshot_id="snap002", rollback_ids=["rb001"]
        )
        self.assertEqual(run2.status, RunStatus.DUPLICATE_OVERRIDE)
        issue = run2.issues[0]
        self.assertEqual(issue.evidence_source, EvidenceType.ROLLBACK_RECORD)
        self.assertIn("回滚", issue.description)
        self.assertTrue(issue.suggested_action)
        self.assertTrue(issue.responsible_hint)

    def test_list_runs(self):
        entries = [LicenseEntry("pkg", "1.0.0", "MIT")]
        self.history.record_run(entries, snapshot_id="snap001")
        runs = self.history.list_runs()
        self.assertGreater(len(runs), 0)


class TestRollbackTracker(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tracker = RollbackTracker(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_record_and_get(self):
        record = self.tracker.record_rollback(
            target_package="express",
            target_version="4.17.0",
            previous_version="4.18.0",
            reason="CVE-2024-xxxx",
            operator="张三",
        )
        self.assertTrue(record.record_id)

        retrieved = self.tracker.get_record(record.record_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.target_package, "express")

    def test_find_by_package(self):
        self.tracker.record_rollback("lodash", "4.17.20", "4.17.21", "bug fix")
        self.tracker.record_rollback("express", "4.17.0", "4.18.0", "security")

        results = self.tracker.find_rollbacks_for_package("lodash")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].target_package, "lodash")

    def test_enrich_entry_with_evidence(self):
        self.tracker.record_rollback("express", "4.17.0", "4.18.0", "security", "张三")
        refs = self.tracker.enrich_entry_with_rollback_evidence("express", [])
        self.assertGreater(len(refs), 0)
        self.assertEqual(refs[0].evidence_type, EvidenceType.ROLLBACK_RECORD)


class TestConfigAuditManager(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.manager = ConfigAuditManager(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_record_change(self):
        record = self.manager.record_change(
            file_path="config.yaml",
            before_content="key: value1\n",
            after_content="key: value2\n",
            operator="李四",
            note="手动调整超时配置",
        )
        self.assertTrue(record.change_id)
        self.assertIn("key: value1", record.before_content)
        self.assertIn("key: value2", record.after_content)
        self.assertTrue(record.diff)

    def test_detect_changes(self):
        self.manager._update_baseline("app.conf", "timeout=30\n")
        change = self.manager.detect_changes("app.conf", "timeout=60\n")
        self.assertIsNotNone(change)
        self.assertIn("timeout=30", change.before_content)
        self.assertIn("timeout=60", change.after_content)

    def test_no_change_detected(self):
        self.manager._update_baseline("app.conf", "timeout=30\n")
        change = self.manager.detect_changes("app.conf", "timeout=30\n")
        self.assertIsNone(change)

    def test_change_history(self):
        self.manager.record_change("a.yaml", "v1\n", "v2\n", "op1")
        self.manager.record_change("a.yaml", "v2\n", "v3\n", "op2")
        history = self.manager.get_change_history("a.yaml")
        self.assertEqual(len(history), 2)

    def test_reconciliation(self):
        record = self.manager.record_change(
            file_path="config.yaml",
            before_content="v1\n",
            after_content="v2\n",
            operator="manual",
            run_id="run001",
        )
        result = self.manager.reconcile_with_run("run001", "")
        self.assertEqual(result["status"], "consistent")


class TestReporter(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.snapshot_mgr = SnapshotManager(self.tmpdir)
        self.history_mgr = HistoryManager(self.tmpdir)
        self.rollback_mgr = RollbackTracker(self.tmpdir)
        self.config_audit = ConfigAuditManager(self.tmpdir)
        self.reporter = Reporter(
            self.history_mgr, self.rollback_mgr, self.snapshot_mgr, self.config_audit
        )

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_inventory_report_with_evidence_trace(self):
        rollback_rec = self.rollback_mgr.record_rollback(
            "lodash", "4.17.20", "4.17.21", "bug fix", "张三"
        )

        entries = [LicenseEntry("lodash", "4.17.20", "MIT")]
        self.rollback_mgr.enrich_entry_with_rollback_evidence(
            "lodash", entries[0].evidence_refs
        )

        run = self.history_mgr.record_run(
            entries, snapshot_id="snap001", rollback_ids=[rollback_rec.record_id]
        )

        report = self.reporter.generate_inventory_report(run.run_id)
        self.assertEqual(report["report_type"], "dependency_license_inventory")
        self.assertGreater(len(report["inventory"]), 0)

        item = report["inventory"][0]
        self.assertEqual(item["package"], "lodash@4.17.20")
        self.assertGreater(len(item["evidence_trace"]), 0)

        found_rollback_evidence = any(
            e["evidence_type"] == "rollback_record" for e in item["evidence_trace"]
        )
        self.assertTrue(found_rollback_evidence)

    def test_evidence_chain_report(self):
        entries = [LicenseEntry("react", "18.0.0", "MIT")]
        run = self.history_mgr.record_run(entries, snapshot_id="snap001")

        report = self.reporter.generate_evidence_chain_report(run.run_id)
        self.assertEqual(report["report_type"], "evidence_chain")

    def test_duplicate_issue_report_with_actionable_info(self):
        entries_v1 = [LicenseEntry("pkg-a", "1.0.0", "MIT")]
        self.history_mgr.record_run(entries_v1, snapshot_id="snap001")

        entries_v2 = [LicenseEntry("pkg-a", "1.0.0", "GPL")]
        run2 = self.history_mgr.record_run(entries_v2, snapshot_id="snap002")

        report = self.reporter.generate_duplicate_issue_report(run2.run_id)
        self.assertEqual(report["status"], "issues_found")
        self.assertGreater(len(report["issues"]), 0)

        issue = report["issues"][0]
        self.assertTrue(issue["description"])
        self.assertTrue(issue["suggested_action"])
        self.assertTrue(issue["responsible"])


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.project_dir = os.path.join(self.tmpdir, "project")
        os.makedirs(self.project_dir)

        pkg = {"dependencies": {"lodash": "^4.17.21"}}
        with open(os.path.join(self.project_dir, "package.json"), "w") as f:
            json.dump(pkg, f)

        self.store_dir = tempfile.mkdtemp()
        self.snapshot_mgr = SnapshotManager(self.store_dir)
        self.history_mgr = HistoryManager(self.store_dir)
        self.rollback_mgr = RollbackTracker(self.store_dir)
        self.config_audit = ConfigAuditManager(self.store_dir)
        self.reporter = Reporter(
            self.history_mgr, self.rollback_mgr, self.snapshot_mgr, self.config_audit
        )
        self.scanner = DependencyScanner(self.project_dir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        shutil.rmtree(self.store_dir, ignore_errors=True)

    def test_full_workflow(self):
        snap = self.snapshot_mgr.take_snapshot(self.project_dir, label="initial")
        entries = self.scanner.scan(snapshot_id=snap.snapshot_id)
        self.rollback_mgr.enrich_entry_with_rollback_evidence(
            "lodash", entries[0].evidence_refs
        )

        run = self.history_mgr.record_run(entries, snapshot_id=snap.snapshot_id)
        self.assertEqual(run.status, RunStatus.SUCCESS)

        report = self.reporter.generate_full_report(run.run_id)
        self.assertIn("inventory", report)
        self.assertIn("evidence_chain", report)
        self.assertIn("duplicate_issues", report)
        self.assertIn("config_reconciliation", report)

        inventory = report["inventory"]
        self.assertGreater(inventory["total_entries"], 0)
        self.assertTrue(inventory["inventory"][0]["evidence_trace"])

    def test_idempotent_scan(self):
        snap = self.snapshot_mgr.take_snapshot(self.project_dir)
        entries = self.scanner.scan(snapshot_id=snap.snapshot_id)

        run1 = self.history_mgr.record_run(entries, snapshot_id=snap.snapshot_id)
        run2 = self.history_mgr.record_run(entries, snapshot_id=snap.snapshot_id)

        self.assertEqual(run1.run_id, run2.run_id)
        self.assertTrue(run2.is_historical)

        runs = self.history_mgr.list_runs()
        success_runs = [r for r in runs if r.status == RunStatus.SUCCESS]
        self.assertEqual(len(success_runs), 1)


if __name__ == "__main__":
    unittest.main()
