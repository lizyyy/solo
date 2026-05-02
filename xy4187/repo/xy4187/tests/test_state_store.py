"""
状态存储模块测试
"""

import unittest
import tempfile
import shutil
import os
import sys
import json

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from state_store import (
    IssueResolution,
    SessionState,
    StateStore
)
from rules_engine import (
    QualityIssue,
    IssueType,
    IssueSeverity
)


class TestIssueResolution(unittest.TestCase):
    """测试问题处理记录"""
    
    def test_creation(self):
        """测试创建"""
        resolution = IssueResolution(
            issue_index=0,
            issue_type="missing_audio",
            item_id="P001",
            audio_file="test.mp3",
            title="测试节目",
            message="测试消息",
            resolved=True,
            resolution_action="accept",
            resolution_note="可接受",
            resolved_at="2026-05-03T10:00:00",
            resolved_by="test_user"
        )
        
        self.assertEqual(resolution.issue_index, 0)
        self.assertEqual(resolution.issue_type, "missing_audio")
        self.assertEqual(resolution.item_id, "P001")
        self.assertEqual(resolution.audio_file, "test.mp3")
        self.assertEqual(resolution.title, "测试节目")
        self.assertEqual(resolution.message, "测试消息")
        self.assertTrue(resolution.resolved)
        self.assertEqual(resolution.resolution_action, "accept")
        self.assertEqual(resolution.resolution_note, "可接受")
        self.assertEqual(resolution.resolved_at, "2026-05-03T10:00:00")
        self.assertEqual(resolution.resolved_by, "test_user")
    
    def test_to_dict(self):
        """测试转换为字典"""
        resolution = IssueResolution(
            issue_index=1,
            issue_type="peak_too_high",
            item_id="A001",
            audio_file="ad.mp3",
            title="测试广告",
            message="峰值过高",
            resolved=True,
            resolution_action="needs_fix",
            resolution_note="需要重新导出"
        )
        
        data = resolution.to_dict()
        
        self.assertEqual(data["issue_index"], 1)
        self.assertEqual(data["issue_type"], "peak_too_high")
        self.assertEqual(data["item_id"], "A001")
        self.assertEqual(data["audio_file"], "ad.mp3")
        self.assertEqual(data["title"], "测试广告")
        self.assertEqual(data["message"], "峰值过高")
        self.assertEqual(data["resolved"], True)
        self.assertEqual(data["resolution_action"], "needs_fix")
        self.assertEqual(data["resolution_note"], "需要重新导出")
    
    def test_from_dict(self):
        """测试从字典创建"""
        data = {
            "issue_index": 2,
            "issue_type": "duration_too_long",
            "item_id": "P003",
            "audio_file": "long.mp3",
            "title": "长节目",
            "message": "时长过长",
            "resolved": False,
            "resolution_action": "",
            "resolution_note": "",
            "resolved_at": "",
            "resolved_by": ""
        }
        
        resolution = IssueResolution.from_dict(data)
        
        self.assertEqual(resolution.issue_index, 2)
        self.assertEqual(resolution.issue_type, "duration_too_long")
        self.assertEqual(resolution.item_id, "P003")
        self.assertEqual(resolution.audio_file, "long.mp3")
        self.assertFalse(resolution.resolved)


class TestSessionState(unittest.TestCase):
    """测试会话状态"""
    
    def test_creation(self):
        """测试创建"""
        state = SessionState(
            session_id="test_123",
            created_at="2026-05-03T10:00:00",
            updated_at="2026-05-03T11:00:00",
            project_name="测试项目",
            schedule_csv_path="/test/schedule.csv",
            audio_directory="/test/audio",
            issue_resolutions=[],
            custom_config={"key": "value"},
            session_notes="测试备注",
            check_history=[]
        )
        
        self.assertEqual(state.session_id, "test_123")
        self.assertEqual(state.created_at, "2026-05-03T10:00:00")
        self.assertEqual(state.updated_at, "2026-05-03T11:00:00")
        self.assertEqual(state.project_name, "测试项目")
        self.assertEqual(state.schedule_csv_path, "/test/schedule.csv")
        self.assertEqual(state.audio_directory, "/test/audio")
        self.assertEqual(state.custom_config, {"key": "value"})
        self.assertEqual(state.session_notes, "测试备注")
    
    def test_to_dict(self):
        """测试转换为字典"""
        resolution = IssueResolution(
            issue_index=0,
            issue_type="missing_audio",
            item_id="P001",
            audio_file="test.mp3",
            title="测试",
            message="测试",
            resolved=True,
            resolution_action="accept"
        )
        
        state = SessionState(
            session_id="abc123",
            created_at="2026-05-03T10:00:00",
            updated_at="2026-05-03T11:00:00",
            project_name="测试",
            schedule_csv_path="/schedule.csv",
            audio_directory="/audio",
            issue_resolutions=[resolution],
            custom_config={"test": True},
            session_notes="备注",
            check_history=[{"action": "test"}]
        )
        
        data = state.to_dict()
        
        self.assertEqual(data["session_id"], "abc123")
        self.assertEqual(data["created_at"], "2026-05-03T10:00:00")
        self.assertEqual(data["updated_at"], "2026-05-03T11:00:00")
        self.assertEqual(data["project_name"], "测试")
        self.assertEqual(data["schedule_csv_path"], "/schedule.csv")
        self.assertEqual(data["audio_directory"], "/audio")
        self.assertEqual(len(data["issue_resolutions"]), 1)
        self.assertEqual(data["custom_config"], {"test": True})
        self.assertEqual(data["session_notes"], "备注")
        self.assertEqual(len(data["check_history"]), 1)
    
    def test_from_dict(self):
        """测试从字典创建"""
        data = {
            "session_id": "xyz789",
            "created_at": "2026-05-03T12:00:00",
            "updated_at": "2026-05-03T13:00:00",
            "project_name": "从字典创建",
            "schedule_csv_path": "/path/schedule.csv",
            "audio_directory": "/path/audio",
            "issue_resolutions": [
                {
                    "issue_index": 0,
                    "issue_type": "sample_rate_mismatch",
                    "item_id": "P002",
                    "audio_file": "audio.wav",
                    "title": "音频",
                    "message": "采样率不符",
                    "resolved": True,
                    "resolution_action": "accept",
                    "resolution_note": "",
                    "resolved_at": "",
                    "resolved_by": ""
                }
            ],
            "custom_config": {},
            "session_notes": "",
            "check_history": []
        }
        
        state = SessionState.from_dict(data)
        
        self.assertEqual(state.session_id, "xyz789")
        self.assertEqual(state.project_name, "从字典创建")
        self.assertEqual(len(state.issue_resolutions), 1)
        self.assertEqual(state.issue_resolutions[0].issue_type, "sample_rate_mismatch")


class TestStateStore(unittest.TestCase):
    """测试状态存储器"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
        self.store = StateStore(base_directory=self.temp_dir)
    
    def tearDown(self):
        """清理测试"""
        shutil.rmtree(self.temp_dir)
    
    def test_initialization(self):
        """测试初始化"""
        self.assertIsNotNone(self.store)
        self.assertEqual(self.store.base_directory, self.temp_dir)
        self.assertTrue(os.path.exists(self.store.state_directory))
    
    def test_generate_session_id(self):
        """测试生成会话ID"""
        id1 = self.store._generate_session_id("/path1/schedule.csv", "/path1/audio")
        id2 = self.store._generate_session_id("/path1/schedule.csv", "/path1/audio")
        id3 = self.store._generate_session_id("/path2/schedule.csv", "/path1/audio")
        
        # 相同路径生成相同ID
        self.assertEqual(id1, id2)
        # 不同路径生成不同ID
        self.assertNotEqual(id1, id3)
        # ID长度固定
        self.assertEqual(len(id1), 12)
    
    def test_create_new_session(self):
        """测试创建新会话"""
        session = self.store.create_new_session(
            project_name="测试项目",
            schedule_csv_path="/test/schedule.csv",
            audio_directory="/test/audio"
        )
        
        self.assertIsNotNone(session.session_id)
        self.assertEqual(session.project_name, "测试项目")
        self.assertEqual(session.schedule_csv_path, "/test/schedule.csv")
        self.assertEqual(session.audio_directory, "/test/audio")
        self.assertIsNotNone(session.created_at)
        self.assertIsNotNone(session.updated_at)
    
    def test_save_and_load_session(self):
        """测试保存和加载会话"""
        # 创建并保存会话
        session = self.store.create_new_session(
            project_name="保存测试",
            schedule_csv_path="/save/schedule.csv",
            audio_directory="/save/audio",
            custom_config={"test_key": "test_value"}
        )
        
        # 添加处理记录
        resolution = IssueResolution(
            issue_index=0,
            issue_type="missing_audio",
            item_id="P001",
            audio_file="test.mp3",
            title="测试",
            message="测试消息",
            resolved=True,
            resolution_action="accept"
        )
        session.issue_resolutions.append(resolution)
        
        # 保存
        saved_path = self.store.save_session(session)
        
        self.assertTrue(os.path.exists(saved_path))
        
        # 重新加载
        loaded_session = self.store.load_session(session.session_id)
        
        self.assertIsNotNone(loaded_session)
        self.assertEqual(loaded_session.session_id, session.session_id)
        self.assertEqual(loaded_session.project_name, "保存测试")
        self.assertEqual(loaded_session.custom_config, {"test_key": "test_value"})
        self.assertEqual(len(loaded_session.issue_resolutions), 1)
        self.assertEqual(loaded_session.issue_resolutions[0].item_id, "P001")
    
    def test_load_session_by_paths(self):
        """测试通过路径加载会话"""
        # 创建会话
        session = self.store.create_new_session(
            project_name="路径测试",
            schedule_csv_path="/path/test/schedule.csv",
            audio_directory="/path/test/audio"
        )
        
        self.store.save_session(session)
        
        # 通过路径加载
        loaded = self.store.load_session_by_paths(
            "/path/test/schedule.csv",
            "/path/test/audio"
        )
        
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.session_id, session.session_id)
    
    def test_list_saved_sessions(self):
        """测试列出保存的会话"""
        # 初始为空
        sessions = self.store.list_saved_sessions()
        self.assertEqual(len(sessions), 0)
        
        # 创建并保存两个会话
        session1 = self.store.create_new_session(
            project_name="会话1",
            schedule_csv_path="/s1/schedule.csv",
            audio_directory="/s1/audio"
        )
        self.store.save_session(session1)
        
        session2 = self.store.create_new_session(
            project_name="会话2",
            schedule_csv_path="/s2/schedule.csv",
            audio_directory="/s2/audio"
        )
        self.store.save_session(session2)
        
        # 列出会话
        sessions = self.store.list_saved_sessions()
        self.assertEqual(len(sessions), 2)
        
        # 验证数据
        project_names = {s["project_name"] for s in sessions}
        self.assertIn("会话1", project_names)
        self.assertIn("会话2", project_names)
    
    def test_delete_session(self):
        """测试删除会话"""
        # 创建并保存会话
        session = self.store.create_new_session(
            project_name="删除测试",
            schedule_csv_path="/delete/schedule.csv",
            audio_directory="/delete/audio"
        )
        self.store.save_session(session)
        
        # 确认存在
        sessions = self.store.list_saved_sessions()
        self.assertEqual(len(sessions), 1)
        
        # 删除
        deleted = self.store.delete_session(session.session_id)
        self.assertTrue(deleted)
        
        # 确认已删除
        sessions = self.store.list_saved_sessions()
        self.assertEqual(len(sessions), 0)
        
        # 再次删除返回False
        deleted = self.store.delete_session(session.session_id)
        self.assertFalse(deleted)
    
    def test_update_issue_resolution(self):
        """测试更新问题处理"""
        session = self.store.create_new_session(
            project_name="更新测试",
            schedule_csv_path="/update/schedule.csv",
            audio_directory="/update/audio"
        )
        
        # 创建问题
        issue = QualityIssue(
            issue_type=IssueType.PEAK_TOO_HIGH,
            severity=IssueSeverity.WARNING,
            item_id="A001",
            audio_file="ad.mp3",
            title="广告",
            message="峰值过高"
        )
        
        # 第一次更新
        session = self.store.update_issue_resolution(
            state=session,
            issue=issue,
            issue_index=0,
            resolution_action="needs_fix",
            resolution_note="需要降低音量"
        )
        
        self.assertEqual(len(session.issue_resolutions), 1)
        self.assertEqual(session.issue_resolutions[0].resolution_action, "needs_fix")
        self.assertEqual(session.issue_resolutions[0].resolution_note, "需要降低音量")
        
        # 第二次更新（应该更新同一条记录）
        session = self.store.update_issue_resolution(
            state=session,
            issue=issue,
            issue_index=0,
            resolution_action="accept",
            resolution_note="可接受"
        )
        
        self.assertEqual(len(session.issue_resolutions), 1)
        self.assertEqual(session.issue_resolutions[0].resolution_action, "accept")
        self.assertEqual(session.issue_resolutions[0].resolution_note, "可接受")
    
    def test_apply_resolutions_to_issues(self):
        """测试应用处理记录到问题列表"""
        # 创建会话
        session = self.store.create_new_session(
            project_name="应用测试",
            schedule_csv_path="/apply/schedule.csv",
            audio_directory="/apply/audio"
        )
        
        # 创建问题列表
        issues = [
            QualityIssue(
                issue_type=IssueType.MISSING_AUDIO,
                severity=IssueSeverity.CRITICAL,
                item_id="P001",
                audio_file="missing.mp3",
                title="缺失",
                message="文件缺失",
                resolved=False
            ),
            QualityIssue(
                issue_type=IssueType.PEAK_TOO_HIGH,
                severity=IssueSeverity.WARNING,
                item_id="P002",
                audio_file="loud.mp3",
                title="音量大",
                message="峰值过高",
                resolved=False
            )
        ]
        
        # 添加处理记录到会话
        resolution1 = IssueResolution(
            issue_index=0,
            issue_type="missing_audio",
            item_id="P001",
            audio_file="missing.mp3",
            title="缺失",
            message="文件缺失",
            resolved=True,
            resolution_action="needs_fix",
            resolution_note="需要补充素材"
        )
        
        resolution2 = IssueResolution(
            issue_index=1,
            issue_type="peak_too_high",
            item_id="P002",
            audio_file="loud.mp3",
            title="音量大",
            message="峰值过高",
            resolved=True,
            resolution_action="accept",
            resolution_note="可接受"
        )
        
        session.issue_resolutions = [resolution1, resolution2]
        
        # 应用处理记录
        updated_issues = self.store.apply_resolutions_to_issues(session, issues)
        
        # 验证
        self.assertTrue(updated_issues[0].resolved)
        self.assertEqual(updated_issues[0].resolution_action, "needs_fix")
        self.assertEqual(updated_issues[0].resolution_note, "需要补充素材")
        
        self.assertTrue(updated_issues[1].resolved)
        self.assertEqual(updated_issues[1].resolution_action, "accept")
        self.assertEqual(updated_issues[1].resolution_note, "可接受")
    
    def test_add_check_history(self):
        """测试添加质检历史"""
        session = self.store.create_new_session(
            project_name="历史测试",
            schedule_csv_path="/history/schedule.csv",
            audio_directory="/history/audio"
        )
        
        # 添加历史记录
        session = self.store.add_check_history(
            state=session,
            check_type="full_check",
            summary="完整质检",
            issue_count=5
        )
        
        self.assertEqual(len(session.check_history), 1)
        self.assertEqual(session.check_history[0]["check_type"], "full_check")
        self.assertEqual(session.check_history[0]["summary"], "完整质检")
        self.assertEqual(session.check_history[0]["issue_count"], 5)
        self.assertIn("timestamp", session.check_history[0])


if __name__ == "__main__":
    unittest.main()
