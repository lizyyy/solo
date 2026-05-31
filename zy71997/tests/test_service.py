from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from multi_repo_tag import MultiRepoTagService, Store, LedgerExporter, RepoStatus
from multi_repo_tag.models import ServiceError


def _create_git_repo(base_dir: str, name: str) -> str:
    repo_path = os.path.join(base_dir, name)
    os.makedirs(repo_path, exist_ok=True)
    subprocess.run(["git", "init", repo_path], capture_output=True, check=True)
    subprocess.run(["git", "-C", repo_path, "config", "user.email", "test@test.com"], capture_output=True, check=True)
    subprocess.run(["git", "-C", repo_path, "config", "user.name", "test"], capture_output=True, check=True)
    readme = os.path.join(repo_path, "README.md")
    with open(readme, "w") as f:
        f.write("# test\n")
    subprocess.run(["git", "-C", repo_path, "add", "."], capture_output=True, check=True)
    subprocess.run(["git", "-C", repo_path, "commit", "-m", "init"], capture_output=True, check=True)
    return repo_path


class TestStore(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.store = Store(db_path)

    def test_repo_crud(self):
        from multi_repo_tag.models import Repository
        repo = Repository(path="/tmp/test repo with spaces", name="test repo")
        saved = self.store.upsert_repo(repo)
        self.assertIsNotNone(saved.id)
        loaded = self.store.get_repo(saved.id)
        self.assertEqual(loaded.path, "/tmp/test repo with spaces")
        self.assertEqual(loaded.name, "test repo")

    def test_repo_upsert_by_path(self):
        from multi_repo_tag.models import Repository
        repo1 = Repository(path="/tmp/same path", name="first")
        saved1 = self.store.upsert_repo(repo1)
        repo2 = Repository(path="/tmp/same path", name="updated", status=RepoStatus.READY)
        saved2 = self.store.upsert_repo(repo2)
        self.assertEqual(saved1.id, saved2.id)
        self.assertEqual(saved2.name, "updated")

    def test_ledger_query(self):
        from multi_repo_tag.models import LedgerEntry, TagAction
        entry = LedgerEntry(action=TagAction.IMPORT_REPO, detail="test entry", operator="alice")
        self.store.insert_ledger(entry)
        results = self.store.query_ledger(operator="alice")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].detail, "test entry")


class TestServiceWithPathSpaces(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.repo_path = _create_git_repo(self.tmpdir, "project with spaces")
        self.svc = MultiRepoTagService(db_path=db_path, operator="tester")

    def test_import_repo_with_spaces(self):
        repo = self.svc.import_repo(self.repo_path)
        self.assertEqual(repo.status, RepoStatus.READY)
        self.assertIn("project with spaces", repo.path)
        self.assertIsNotNone(repo.git_branch)

    def test_apply_tag(self):
        repo = self.svc.import_repo(self.repo_path)
        tag = self.svc.apply_tag(repo.id, "v1.0.0", "first release")
        self.assertEqual(tag.tag_name, "v1.0.0")
        self.assertFalse(tag.confirmed)

    def test_confirm_tag(self):
        repo = self.svc.import_repo(self.repo_path)
        tag = self.svc.apply_tag(repo.id, "v1.0.0", "first release")
        confirmed = self.svc.confirm_tag(tag.id)
        self.assertTrue(confirmed.confirmed)

    def test_correct_tag(self):
        repo = self.svc.import_repo(self.repo_path)
        tag = self.svc.apply_tag(repo.id, "v1.0.0", "first")
        new_tag = self.svc.correct_tag(repo.id, "v1.0.0", "v1.0.1", "typo fix")
        self.assertEqual(new_tag.tag_name, "v1.0.1")
        old_tag = self.svc.store.get_tag(tag.id)
        self.assertEqual(old_tag.superseded_by, new_tag.id)

    def test_duplicate_tag_error(self):
        repo = self.svc.import_repo(self.repo_path)
        self.svc.apply_tag(repo.id, "v1.0.0", "first")
        with self.assertRaises(ServiceError) as ctx:
            self.svc.apply_tag(repo.id, "v1.0.0", "duplicate")
        self.assertEqual(ctx.exception.code, "TAG_EXISTS")


class TestChangeOrderReupload(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.repo_a = _create_git_repo(self.tmpdir, "repo A")
        self.repo_b = _create_git_repo(self.tmpdir, "repo B")
        self.svc = MultiRepoTagService(db_path=db_path, operator="tester")

    def test_first_upload(self):
        entries = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "release"},
        ]
        result = self.svc.import_change_order("ORD-001", entries)
        self.assertFalse(result.is_reupload)
        self.assertEqual(result.change_order.version, 1)
        self.assertIsNone(result.warning)

    def test_same_content_reupload(self):
        entries = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries)
        result = self.svc.import_change_order("ORD-001", entries)
        self.assertTrue(result.is_reupload)
        self.assertIn("完全一致", result.warning)

    def test_modified_content_reupload_alerts_diff(self):
        entries_v1 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries_v1)
        entries_v2 = [
            {"repo_path": self.repo_a, "tag_name": "v1.1", "description": "hotfix"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "release"},
        ]
        result = self.svc.import_change_order("ORD-001", entries_v2)
        self.assertTrue(result.is_reupload)
        self.assertIsNotNone(result.diff)
        self.assertEqual(result.diff.old_version, 1)
        self.assertEqual(result.diff.new_version, 2)
        self.assertEqual(len(result.diff.modified_entries), 1)
        self.assertIn("v1.0", result.diff.modified_entries[0][0].tag_name)
        self.assertIn("v1.1", result.diff.modified_entries[0][1].tag_name)
        self.assertIn("请确认", result.warning)
        self.assertIn("差异", result.warning)

    def test_added_entry_reupload(self):
        entries_v1 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries_v1)
        entries_v2 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "new"},
        ]
        result = self.svc.import_change_order("ORD-001", entries_v2)
        self.assertEqual(len(result.diff.added_entries), 1)

    def test_removed_entry_reupload(self):
        entries_v1 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
            {"repo_path": self.repo_b, "tag_name": "v2.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries_v1)
        entries_v2 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
        ]
        result = self.svc.import_change_order("ORD-001", entries_v2)
        self.assertEqual(len(result.diff.removed_entries), 1)

    def test_cannot_apply_tags_with_unacknowledged_diff(self):
        entries_v1 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries_v1)
        self.svc.import_repo(self.repo_a)
        self.svc.apply_tags_from_order("ORD-001")
        entries_v2 = [
            {"repo_path": self.repo_a, "tag_name": "v1.1", "description": "hotfix"},
        ]
        self.svc.import_change_order("ORD-001", entries_v2)
        with self.assertRaises(ServiceError) as ctx:
            self.svc.apply_tags_from_order("ORD-001")
        self.assertEqual(ctx.exception.code, "UNACKNOWLEDGED_DIFF")

    def test_acknowledge_then_apply(self):
        entries_v1 = [{"repo_path": self.repo_a, "tag_name": "v1.0", "description": "r"}]
        self.svc.import_change_order("ORD-001", entries_v1)
        entries_v2 = [{"repo_path": self.repo_a, "tag_name": "v1.1", "description": "h"}]
        result = self.svc.import_change_order("ORD-001", entries_v2)
        diff = result.diff
        self.svc.acknowledge_diff(diff.id, "reviewer")
        diffs = self.svc.get_unacknowledged_diffs()
        self.assertEqual(len(diffs), 0)

    def test_affected_repos_marked_needs_review(self):
        entries_v1 = [
            {"repo_path": self.repo_a, "tag_name": "v1.0", "description": "release"},
        ]
        self.svc.import_change_order("ORD-001", entries_v1)
        self.svc.import_repo(self.repo_a)
        entries_v2 = [
            {"repo_path": self.repo_a, "tag_name": "v1.1", "description": "hotfix"},
        ]
        self.svc.import_change_order("ORD-001", entries_v2)
        repo = self.svc.store.get_repo_by_path(str(Path(self.repo_a).resolve()))
        self.assertEqual(repo.status, RepoStatus.NEEDS_REVIEW)

    def test_order_history(self):
        entries_v1 = [{"repo_path": self.repo_a, "tag_name": "v1.0", "description": "r"}]
        self.svc.import_change_order("ORD-001", entries_v1)
        entries_v2 = [{"repo_path": self.repo_a, "tag_name": "v1.1", "description": "h"}]
        self.svc.import_change_order("ORD-001", entries_v2)
        history = self.svc.get_order_history("ORD-001")
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].version, 1)
        self.assertEqual(history[1].version, 2)


class TestLedgerExporter(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.store = Store(db_path)
        self.exporter = LedgerExporter(self.store)

    def test_export_empty(self):
        text = self.exporter.export_text()
        self.assertIn("无记录", text)

    def test_export_json_roundtrip(self):
        from multi_repo_tag.models import LedgerEntry, TagAction
        entry = LedgerEntry(action=TagAction.APPLY_TAG, detail="test", operator="bob")
        self.store.insert_ledger(entry)
        json_str = self.exporter.export_json()
        data = json.loads(json_str)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["action"], "apply_tag")

    def test_handoff_report(self):
        from multi_repo_tag.models import Repository, LedgerEntry, TagAction
        repo = Repository(path="/tmp/test repo", name="test repo", status=RepoStatus.READY)
        self.store.upsert_repo(repo)
        entry = LedgerEntry(action=TagAction.IMPORT_REPO, detail="imported", operator="alice")
        self.store.insert_ledger(entry)
        report = self.exporter.export_handoff_report()
        self.assertIn("交接报告", report)
        self.assertIn("仓库状态总览", report)
        self.assertIn("test repo", report)
        self.assertIn("未确认标签", report)
        self.assertIn("最近操作记录", report)

    def test_write_to_file(self):
        text = self.exporter.export_text()
        out_path = os.path.join(self.tmpdir, "output", "ledger.txt")
        result = self.exporter.write_to_file(text, out_path)
        self.assertTrue(os.path.exists(result))
        content = Path(result).read_text(encoding="utf-8")
        self.assertIn("运行账本", content)


class TestMissingPath(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.svc = MultiRepoTagService(db_path=db_path, operator="tester")

    def test_nonexistent_path(self):
        repo = self.svc.import_repo("/nonexistent/path with spaces")
        self.assertEqual(repo.status, RepoStatus.PATH_MISSING)
        self.assertIn("路径不存在", repo.error_detail)

    def test_non_git_path(self):
        nongit = os.path.join(self.tmpdir, "not a git repo")
        os.makedirs(nongit, exist_ok=True)
        repo = self.svc.import_repo(nongit)
        self.assertEqual(repo.status, RepoStatus.NOT_GIT_REPO)


class TestReviewWorkflow(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(self.tmpdir, "test.db")
        self.repo_path = _create_git_repo(self.tmpdir, "review repo")
        self.svc = MultiRepoTagService(db_path=db_path, operator="tester")

    def test_review_shows_unconfirmed(self):
        repo = self.svc.import_repo(self.repo_path)
        self.svc.apply_tag(repo.id, "v1.0.0", "first")
        review = self.svc.review_tags()
        self.assertEqual(len(review), 1)
        tags = review[0]["tags"]
        self.assertEqual(len(tags), 1)
        self.assertFalse(tags[0]["confirmed"])

    def test_confirm_all(self):
        repo = self.svc.import_repo(self.repo_path)
        self.svc.apply_tag(repo.id, "v1.0.0", "first")
        self.svc.apply_tag(repo.id, "v2.0.0", "second")
        confirmed = self.svc.confirm_all_tags(repo.id)
        self.assertEqual(len(confirmed), 2)
        self.assertTrue(all(t.confirmed for t in confirmed))


if __name__ == "__main__":
    unittest.main()
