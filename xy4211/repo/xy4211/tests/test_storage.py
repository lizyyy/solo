import sys
from pathlib import Path
import tempfile
import json
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import unittest
from storage.local_storage import LocalStorage, ReviewState, StorageManager
from models.validation_issue import ValidationIssue, IssueType, IssueSeverity, ReviewStatus
from models.student import Student


class TestLocalStorage(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.storage_path = Path(self.temp_dir) / "test_session.json"
        self.storage = LocalStorage(self.storage_path)
        
        self.test_issues = [
            ValidationIssue(
                issue_id="ISSUE001",
                issue_type=IssueType.CALIBRATION_EXPIRED,
                severity=IssueSeverity.CRITICAL,
                title="校准证书过期",
                description="设备AUD001的校准证书已过期",
                affected_device_id="AUD001",
                affected_student_id=None,
                affected_screening_id=None,
                review_status=ReviewStatus.UNREVIEWED
            ),
            ValidationIssue(
                issue_id="ISSUE002",
                issue_type=IssueType.THRESHOLD_ANOMALY,
                severity=IssueSeverity.MEDIUM,
                title="听力阈值异常",
                description="左耳高频阈值过高",
                affected_device_id="AUD001",
                affected_student_id="S001",
                affected_screening_id="SR001",
                review_status=ReviewStatus.UNREVIEWED
            )
        ]
        
        self.test_state = ReviewState(
            students=[],
            screening_results=[],
            device_logs=[],
            certificates=[],
            issues=self.test_issues,
            imported_files=[],
            session_name="测试会话",
            metadata={"device_ids": ["AUD001"]}
        )
    
    def tearDown(self):
        if self.storage_path.exists():
            self.storage_path.unlink()
        import shutil
        shutil.rmtree(self.temp_dir)
        
        if StorageManager._instance is not None:
            StorageManager._instance = None
    
    def test_save_and_load_state(self):
        self.assertTrue(self.storage.save(self.test_state))
        
        loaded_state = self.storage.load()
        
        self.assertIsNotNone(loaded_state)
        self.assertEqual(loaded_state.session_name, "测试会话")
        self.assertEqual(len(loaded_state.issues), 2)
        self.assertEqual(loaded_state.issues[0].issue_id, "ISSUE001")
        self.assertEqual(loaded_state.issues[0].issue_type, IssueType.CALIBRATION_EXPIRED)
    
    def test_update_issue_review(self):
        self.storage.save(self.test_state)
        
        loaded_state = self.storage.load()
        success = loaded_state.update_issue_review("ISSUE001", ReviewStatus.CONFIRMED, "已确认问题")
        
        self.assertTrue(success)
        self.assertEqual(loaded_state.issues[0].review_status, ReviewStatus.CONFIRMED)
        self.assertEqual(loaded_state.issues[0].review_notes, "已确认问题")
        self.assertIsNotNone(loaded_state.issues[0].review_timestamp)
        
        self.storage.save(loaded_state)
        reloaded = self.storage.load()
        self.assertEqual(reloaded.issues[0].review_status, ReviewStatus.CONFIRMED)
    
    def test_get_issue_by_id(self):
        issue = self.test_state.get_issue_by_id("ISSUE001")
        self.assertIsNotNone(issue)
        self.assertEqual(issue.issue_id, "ISSUE001")
        
        not_found = self.test_state.get_issue_by_id("NONEXISTENT")
        self.assertIsNone(not_found)
    
    def test_state_file_created(self):
        self.assertFalse(self.storage_path.exists())
        
        self.storage.save(self.test_state)
        
        self.assertTrue(self.storage_path.exists())
        
        with open(self.storage_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.assertIn("session_name", data)
        self.assertIn("issues", data)
        self.assertIn("created_at", data)
        self.assertIn("last_modified", data)
    
    def test_load_nonexistent_state(self):
        loaded = self.storage.load()
        self.assertIsNone(loaded)
    
    def test_clear_all(self):
        self.test_state.students = [Student(student_id="S001", name="张三")]
        self.assertEqual(len(self.test_state.students), 1)
        
        self.test_state.clear_all()
        
        self.assertEqual(len(self.test_state.students), 0)
        self.assertEqual(len(self.test_state.issues), 0)
        self.assertEqual(len(self.test_state.imported_files), 0)
    
    def test_exists_method(self):
        self.assertFalse(self.storage.exists())
        
        self.storage.save(self.test_state)
        
        self.assertTrue(self.storage.exists())
    
    def test_delete_method(self):
        self.storage.save(self.test_state)
        self.assertTrue(self.storage.exists())
        
        result = self.storage.delete()
        self.assertTrue(result)
        self.assertFalse(self.storage.exists())
    
    def test_delete_nonexistent(self):
        result = self.storage.delete()
        self.assertFalse(result)
    
    def test_review_state_with_students(self):
        student = Student(student_id="S001", name="张三", gender="男", age=8)
        
        state = ReviewState(
            students=[student],
            session_name="测试学生数据"
        )
        
        self.storage.save(state)
        
        loaded = self.storage.load()
        self.assertEqual(len(loaded.students), 1)
        self.assertEqual(loaded.students[0].student_id, "S001")
        self.assertEqual(loaded.students[0].name, "张三")
    
    def test_review_status_transitions(self):
        state = ReviewState(
            issues=self.test_issues,
            session_name="测试状态转换"
        )
        
        state.update_issue_review("ISSUE001", ReviewStatus.CONFIRMED, "确认问题")
        self.assertEqual(state.issues[0].review_status, ReviewStatus.CONFIRMED)
        
        state.update_issue_review("ISSUE001", ReviewStatus.REJECTED, "排除问题")
        self.assertEqual(state.issues[0].review_status, ReviewStatus.REJECTED)
        
        state.update_issue_review("ISSUE001", ReviewStatus.RESOLVED, "已解决")
        self.assertEqual(state.issues[0].review_status, ReviewStatus.RESOLVED)
        
        state.update_issue_review("ISSUE001", ReviewStatus.UNREVIEWED, "重置")
        self.assertEqual(state.issues[0].review_status, ReviewStatus.UNREVIEWED)


if __name__ == "__main__":
    unittest.main()
