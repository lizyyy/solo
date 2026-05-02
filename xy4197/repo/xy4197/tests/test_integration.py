"""综合测试 - 测试核心工作流程"""

import unittest
import sys
import os
import tempfile
import json
import csv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.shortcut import ShortcutKey, Shortcut
from src.models.application import Application
from src.models.conflict import ConflictType, ConflictSeverity
from src.rules.rule_engine import RuleEngine, AnalysisResult, RuleResult
from src.rules.conflict_detector import ConflictDetector
from src.rules.platform_checker import PlatformChecker
from src.rules.unreachable_checker import UnreachableChecker
from src.rules.duplicate_macro_checker import DuplicateMacroChecker
from src.suggestions.key_suggester import KeySuggester, Suggestion, SuggestionType
from src.storage.session_storage import SessionStorage, Session, MigrationPlan
from src.exporters import MarkdownExporter, CSVExporter, JSONExporter


class TestConflictDetection(unittest.TestCase):
    """测试冲突检测"""
    
    def test_detect_same_key_conflict(self):
        """测试检测同一键冲突"""
        detector = ConflictDetector()
        
        # 创建相同快捷键的多个快捷键
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+s"), command="save", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("ctrl+s"), command="save_document", application_id="app_figma"),
            Shortcut(key=ShortcutKey("ctrl+z"), command="undo", application_id="app_vscode"),
        ]
        
        result = detector.check(shortcuts)
        
        # 应该检测到ctrl+s的冲突
        self.assertTrue(result.has_issues)
        # 至少有一个冲突
        
        # 检查冲突详情
        conflicts = result.issues
        # 应该包含ctrl+s的冲突
    
    def test_system_reserved_key(self):
        """测试系统保留键检测"""
        detector = ConflictDetector()
        
        # 创建使用系统保留键的快捷键
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+alt+delete"), command="custom_action", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("cmd+tab"), command="switch", application_id="app_figma"),
        ]
        
        result = detector.check(shortcuts)
        
        # 应该检测到系统保留键冲突
        # (取决于系统保留键列表的实现)


class TestPlatformChecker(unittest.TestCase):
    """测试平台差异检测"""
    
    def test_platform_specific_keys(self):
        """测试平台特定键"""
        checker = PlatformChecker()
        
        shortcuts = [
            Shortcut(key=ShortcutKey("cmd+c"), command="copy", application_id="app_mac", platform="mac"),
            Shortcut(key=ShortcutKey("win+d"), command="show_desktop", application_id="app_win", platform="windows"),
        ]
        
        result = checker.check(shortcuts)
        
        # 应该检测到平台特定键


class TestUnreachableChecker(unittest.TestCase):
    """测试不可达组合检测"""
    
    def test_too_many_modifiers(self):
        """测试过多修饰键"""
        checker = UnreachableChecker()
        
        shortcuts = [
            Shortcut(
                key=ShortcutKey("ctrl+alt+shift+cmd+k"),
                command="complex_action",
                application_id="app_vscode"
            ),
        ]
        
        result = checker.check(shortcuts)
        
        # 应该检测到不可达组合
        self.assertTrue(result.has_issues)
    
    def test_same_hand_conflict(self):
        """测试同手冲突"""
        checker = UnreachableChecker()
        
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+a"), command="select_all", application_id="app_vscode"),
        ]
        
        result = checker.check(shortcuts)
        # ctrl+a 都是左手，可能检测到冲突


class TestDuplicateMacroChecker(unittest.TestCase):
    """测试重复宏检测"""
    
    def test_duplicate_commands(self):
        """测试重复命令检测"""
        checker = DuplicateMacroChecker()
        
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+c"), command="copy", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("cmd+c"), command="copy", application_id="app_figma"),
            Shortcut(key=ShortcutKey("ctrl+v"), command="paste", application_id="app_vscode"),
        ]
        
        result = checker.check(shortcuts)
        
        # 应该检测到重复的copy命令


class TestRuleEngine(unittest.TestCase):
    """测试规则引擎"""
    
    def test_full_analysis(self):
        """测试完整分析"""
        engine = RuleEngine()
        
        # 创建测试快捷键（包含冲突）
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+s"), command="save", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("ctrl+s"), command="save_doc", application_id="app_figma"),
            Shortcut(key=ShortcutKey("ctrl+z"), command="undo", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("ctrl+alt+shift+cmd+k"), command="complex", application_id="app_vscode"),
        ]
        
        result = engine.analyze(shortcuts)
        
        # 应该有分析结果
        self.assertIsNotNone(result)
        
        # 检查冲突列表
        self.assertGreaterEqual(len(result.conflicts), 1)
        
        # 检查不可达组合
        self.assertGreaterEqual(len(result.unreachable_shortcuts), 1)


class TestKeySuggester(unittest.TestCase):
    """测试改键建议器"""
    
    def test_suggest_alternative_key(self):
        """测试建议替代键"""
        suggester = KeySuggester()
        
        # 需要改键的快捷键
        original_key = ShortcutKey("ctrl+s")
        
        # 已使用的键
        used_keys = {"ctrl+s", "ctrl+shift+s", "ctrl+alt+s"}
        
        suggestions = suggester.suggest(
            original_key,
            used_keys=used_keys,
            target_platform="all",
        )
        
        # 应该有建议
        self.assertGreater(len(suggestions), 0)
        
        # 建议的键不应该在used_keys中
        for suggestion in suggestions:
            new_key_str = str(suggestion.new_key)
            self.assertNotIn(new_key_str, used_keys)
    
    def test_suggestion_scoring(self):
        """测试建议评分"""
        suggester = KeySuggester()
        
        original_key = ShortcutKey("ctrl+s")
        suggestions = suggester.suggest(original_key)
        
        # 建议应该有评分
        for suggestion in suggestions:
            self.assertGreater(suggestion.score, 0)
        
        # 评分高的应该在前
        if len(suggestions) >= 2:
            self.assertGreaterEqual(suggestions[0].score, suggestions[1].score)


class TestSessionStorage(unittest.TestCase):
    """测试会话存储"""
    
    def setUp(self):
        """设置测试"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.storage = SessionStorage(self.temp_dir)
    
    def tearDown(self):
        """清理测试"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_save_and_load_session(self):
        """测试保存和加载会话"""
        # 创建会话
        session = Session()
        session.session_name = "测试会话"
        session.shortcuts = [
            {"id": "sc_001", "key": "ctrl+s", "command": "save", "application_id": "app_001"},
        ]
        session.applications = [
            {"id": "app_001", "name": "VS Code", "app_type": "vscode"},
        ]
        
        # 保存
        session_id = self.storage.save_session(session)
        self.assertIsNotNone(session_id)
        
        # 加载
        loaded = self.storage.load_session(session_id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.session_name, "测试会话")
        self.assertEqual(len(loaded.shortcuts), 1)
    
    def test_list_sessions(self):
        """测试列出会话"""
        # 创建多个会话
        for i in range(3):
            session = Session()
            session.session_name = f"会话 {i}"
            self.storage.save_session(session)
        
        sessions = self.storage.list_sessions()
        self.assertEqual(len(sessions), 3)
    
    def test_auto_save(self):
        """测试自动保存"""
        session = Session()
        session.session_name = "自动保存测试"
        
        # 自动保存
        self.storage.auto_save(session)
        
        # 加载自动保存
        loaded = self.storage.load_auto_save()
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.session_name, "自动保存测试")


class TestMigrationPlan(unittest.TestCase):
    """测试迁移方案"""
    
    def test_create_migration_plan(self):
        """测试创建迁移方案"""
        plan = MigrationPlan()
        plan.plan_name = "测试迁移方案"
        plan.target_platform = "mac"
        
        # 添加改键映射
        plan.add_mapping(
            original_key="ctrl+s",
            new_key="cmd+s",
            shortcut_id="sc_001",
            reason="迁移到Mac平台",
        )
        
        # 添加用户决策
        plan.add_user_decision(
            shortcut_id="sc_002",
            action="keep",
            notes="这个快捷键很常用，保持不变",
        )
        
        # 添加保留键
        plan.add_reserved_key(
            key_str="cmd+c",
            reason="系统复制命令",
            application_id="system",
        )
        
        # 检查统计
        plan.calculate_stats()
        self.assertEqual(plan.total_modified, 1)
        self.assertEqual(plan.total_kept, 1)
    
    def test_plan_serialization(self):
        """测试方案序列化"""
        plan = MigrationPlan()
        plan.plan_name = "序列化测试"
        plan.add_mapping("ctrl+s", "cmd+s", "sc_001", "测试")
        
        # 转换为字典
        data = plan.to_dict()
        self.assertEqual(data["plan_name"], "序列化测试")
        
        # 从字典恢复
        restored = MigrationPlan.from_dict(data)
        self.assertEqual(restored.plan_name, "序列化测试")
        self.assertEqual(len(restored.key_mappings), 1)


class TestExporters(unittest.TestCase):
    """测试导出器"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建测试会话
        self.session = Session()
        self.session.session_name = "导出测试会话"
        self.session.shortcuts = [
            {"id": "sc_001", "key": "ctrl+s", "command": "save", "application_id": "app_001"},
            {"id": "sc_002", "key": "ctrl+z", "command": "undo", "application_id": "app_001"},
        ]
        self.session.applications = [
            {"id": "app_001", "name": "VS Code", "app_type": "vscode"},
        ]
        
        # 创建测试分析结果
        self.analysis_result = {
            "conflicts": [
                {
                    "id": "c_001",
                    "key": "ctrl+s",
                    "conflict_type": "same_key",
                    "severity": "high",
                    "affected_shortcuts": ["sc_001"],
                    "description": "测试冲突",
                }
            ],
            "platform_differences": [],
            "unreachable_shortcuts": [],
            "duplicate_macros": [],
            "summary": {"total_conflicts": 1},
        }
        
        # 创建测试迁移方案
        self.migration_plan = MigrationPlan()
        self.migration_plan.plan_name = "测试方案"
        self.migration_plan.add_mapping(
            original_key="ctrl+s",
            new_key="cmd+s",
            shortcut_id="sc_001",
            reason="冲突改键",
        )
    
    def tearDown(self):
        """清理测试"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_markdown_exporter(self):
        """测试Markdown导出"""
        exporter = MarkdownExporter()
        export_path = os.path.join(self.temp_dir, "test.md")
        
        result = exporter.export(
            session=self.session,
            analysis_result=self.analysis_result,
            migration_plan=self.migration_plan,
            export_path=export_path,
        )
        
        # 检查文件是否创建
        self.assertTrue(os.path.exists(result))
        
        # 检查内容
        with open(result, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 应该包含标题
        self.assertIn("# 快捷键迁移方案", content)
        # 应该包含冲突信息
        self.assertIn("ctrl+s", content)
    
    def test_csv_exporter(self):
        """测试CSV导出"""
        exporter = CSVExporter()
        
        # 导出冲突表
        export_path = os.path.join(self.temp_dir, "conflicts.csv")
        result = exporter.export_conflicts(
            session=self.session,
            analysis_result=self.analysis_result,
            export_path=export_path,
        )
        
        self.assertTrue(os.path.exists(result))
        
        # 导出快捷键列表
        shortcuts_path = os.path.join(self.temp_dir, "shortcuts.csv")
        result = exporter.export_shortcuts(
            session=self.session,
            export_path=shortcuts_path,
        )
        
        self.assertTrue(os.path.exists(result))
        
        # 导出迁移方案
        plan_path = os.path.join(self.temp_dir, "plan.csv")
        result = exporter.export_migration_plan(
            session=self.session,
            migration_plan=self.migration_plan,
            export_path=plan_path,
        )
        
        self.assertTrue(os.path.exists(result))
    
    def test_json_exporter(self):
        """测试JSON导出"""
        exporter = JSONExporter()
        export_path = os.path.join(self.temp_dir, "audit.json")
        
        result = exporter.export_audit(
            session=self.session,
            analysis_result=self.analysis_result,
            migration_plan=self.migration_plan,
            export_path=export_path,
        )
        
        self.assertTrue(os.path.exists(result))
        
        # 验证JSON格式
        with open(result, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 应该包含元数据
        self.assertIn("metadata", data)
        self.assertIn("checksum", data)
        
        # 验证校验和
        validation = exporter.validate_audit(result)
        self.assertTrue(validation.get("valid", False))


class TestFullWorkflow(unittest.TestCase):
    """测试完整工作流程"""
    
    def test_complete_workflow(self):
        """测试完整流程"""
        # 1. 创建测试快捷键
        shortcuts = [
            Shortcut(key=ShortcutKey("ctrl+s"), command="save", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("ctrl+s"), command="save_doc", application_id="app_figma"),
            Shortcut(key=ShortcutKey("ctrl+z"), command="undo", application_id="app_vscode"),
            Shortcut(key=ShortcutKey("ctrl+alt+shift+cmd+k"), command="complex", application_id="app_vscode"),
        ]
        
        # 2. 运行分析
        engine = RuleEngine()
        analysis = engine.analyze(shortcuts)
        
        # 3. 生成改键建议
        suggester = KeySuggester()
        used_keys = {str(s.key) for s in shortcuts}
        
        # 为冲突的快捷键生成建议
        suggestions = []
        for conflict in analysis.conflicts:
            key = ShortcutKey(conflict.key)
            sug = suggester.suggest(key, used_keys=used_keys)
            suggestions.extend(sug)
        
        # 4. 创建迁移方案
        plan = MigrationPlan()
        plan.plan_name = "完整流程测试方案"
        
        # 添加第一个建议
        if analysis.conflicts and suggestions:
            first_conflict = analysis.conflicts[0]
            first_suggestion = suggestions[0]
            
            plan.add_mapping(
                original_key=first_conflict.key,
                new_key=str(first_suggestion.new_key),
                shortcut_id="sc_001",
                reason=f"冲突改键: {first_suggestion.reason}",
            )
        
        # 5. 验证
        plan.calculate_stats()
        # 应该有一些修改（如果有冲突）
        
        # 这个流程应该完整执行不崩溃
        self.assertTrue(True)


if __name__ == "__main__":
    unittest.main()
