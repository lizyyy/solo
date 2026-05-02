"""测试数据模型"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.shortcut import ShortcutKey, Shortcut
from src.models.application import Application
from src.models.context import Context
from src.models.conflict import (
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)


class TestShortcutKey(unittest.TestCase):
    """测试快捷键模型"""
    
    def test_parse_basic_key(self):
        """测试解析基本快捷键"""
        key = ShortcutKey("ctrl+c")
        self.assertTrue(key.has_modifier("ctrl"))
        self.assertEqual(key.primary_key, "c")
        self.assertEqual(str(key), "ctrl+c")
    
    def test_parse_multiple_modifiers(self):
        """测试解析多个修饰键"""
        key = ShortcutKey("ctrl+shift+p")
        self.assertTrue(key.has_modifier("ctrl"))
        self.assertTrue(key.has_modifier("shift"))
        self.assertEqual(key.primary_key, "p")
    
    def test_parse_cmd_mac(self):
        """测试解析Mac的cmd键"""
        key = ShortcutKey("cmd+c")
        self.assertTrue(key.has_modifier("cmd"))
        self.assertEqual(key.primary_key, "c")
    
    def test_key_equality(self):
        """测试快捷键相等性"""
        key1 = ShortcutKey("ctrl+c")
        key2 = ShortcutKey("ctrl+c")
        key3 = ShortcutKey("ctrl+v")
        
        self.assertEqual(key1, key2)
        self.assertNotEqual(key1, key3)
    
    def test_key_hash(self):
        """测试快捷键哈希"""
        key1 = ShortcutKey("ctrl+c")
        key2 = ShortcutKey("ctrl+c")
        
        # 应该可以用作字典键
        shortcut_set = {key1}
        self.assertIn(key2, shortcut_set)
    
    def test_to_dict(self):
        """测试转换为字典"""
        key = ShortcutKey("ctrl+shift+p")
        data = key.to_dict()
        
        self.assertIn("key_str", data)
        self.assertIn("modifiers", data)
        self.assertIn("primary_key", data)
        self.assertEqual(data["key_str"], "ctrl+shift+p")


class TestShortcut(unittest.TestCase):
    """测试快捷键配置模型"""
    
    def test_create_shortcut(self):
        """测试创建快捷键"""
        shortcut = Shortcut(
            key=ShortcutKey("ctrl+s"),
            command="workbench.action.files.save",
            application_id="app_vscode",
        )
        
        self.assertEqual(str(shortcut.key), "ctrl+s")
        self.assertEqual(shortcut.command, "workbench.action.files.save")
        self.assertEqual(shortcut.application_id, "app_vscode")
    
    def test_shortcut_to_dict(self):
        """测试快捷键转换为字典"""
        shortcut = Shortcut(
            key=ShortcutKey("ctrl+s"),
            command="save",
            application_id="app_vscode",
            context_id="ctx_editor",
            platform="all",
        )
        
        data = shortcut.to_dict()
        
        self.assertEqual(data["key"], "ctrl+s")
        self.assertEqual(data["command"], "save")
        self.assertEqual(data["application_id"], "app_vscode")
        self.assertEqual(data["context_id"], "ctx_editor")
        self.assertEqual(data["platform"], "all")


class TestApplication(unittest.TestCase):
    """测试应用模型"""
    
    def test_create_application(self):
        """测试创建应用"""
        app = Application(
            id="app_vscode",
            name="Visual Studio Code",
            app_type="vscode",
        )
        
        self.assertEqual(app.id, "app_vscode")
        self.assertEqual(app.name, "Visual Studio Code")
        self.assertEqual(app.app_type, "vscode")
    
    def test_application_to_dict(self):
        """测试应用转换为字典"""
        app = Application(
            id="app_figma",
            name="Figma",
            app_type="figma",
        )
        
        data = app.to_dict()
        
        self.assertEqual(data["id"], "app_figma")
        self.assertEqual(data["name"], "Figma")
        self.assertEqual(data["app_type"], "figma")


class TestContext(unittest.TestCase):
    """测试上下文模型"""
    
    def test_create_context(self):
        """测试创建上下文"""
        ctx = Context(
            id="ctx_editor",
            name="编辑器",
            application_id="app_vscode",
        )
        
        self.assertEqual(ctx.id, "ctx_editor")
        self.assertEqual(ctx.name, "编辑器")
        self.assertEqual(ctx.application_id, "app_vscode")


class TestConflict(unittest.TestCase):
    """测试冲突模型"""
    
    def test_create_conflict(self):
        """测试创建冲突"""
        conflict = Conflict(
            id="c_001",
            key="ctrl+s",
            conflict_type=ConflictType.SAME_KEY,
            severity=ConflictSeverity.HIGH,
            affected_shortcuts=["sc_001", "sc_002"],
            description="同一快捷键被多个应用使用",
        )
        
        self.assertEqual(conflict.id, "c_001")
        self.assertEqual(conflict.key, "ctrl+s")
        self.assertEqual(conflict.conflict_type, ConflictType.SAME_KEY)
        self.assertEqual(conflict.severity, ConflictSeverity.HIGH)
        self.assertEqual(len(conflict.affected_shortcuts), 2)
    
    def test_conflict_to_dict(self):
        """测试冲突转换为字典"""
        conflict = Conflict(
            id="c_001",
            key="ctrl+s",
            conflict_type=ConflictType.SAME_KEY,
            severity=ConflictSeverity.HIGH,
            affected_shortcuts=["sc_001"],
        )
        
        data = conflict.to_dict()
        
        self.assertEqual(data["id"], "c_001")
        self.assertEqual(data["key"], "ctrl+s")
        self.assertEqual(data["conflict_type"], "same_key")
        self.assertEqual(data["severity"], "high")


class TestPlatformDifference(unittest.TestCase):
    """测试平台差异模型"""
    
    def test_create_platform_diff(self):
        """测试创建平台差异"""
        diff = PlatformDifference(
            id="pd_001",
            shortcut_id="sc_001",
            mac_key="cmd+c",
            win_key="ctrl+c",
            issue_type="platform_specific",
        )
        
        self.assertEqual(diff.id, "pd_001")
        self.assertEqual(diff.shortcut_id, "sc_001")
        self.assertEqual(diff.mac_key, "cmd+c")
        self.assertEqual(diff.win_key, "ctrl+c")


class TestUnreachableShortcut(unittest.TestCase):
    """测试不可达组合模型"""
    
    def test_create_unreachable(self):
        """测试创建不可达组合"""
        unreachable = UnreachableShortcut(
            id="u_001",
            shortcut_id="sc_001",
            reason="修饰键过多",
            details={"too_many_modifiers": True, "modifier_count": 4},
        )
        
        self.assertEqual(unreachable.id, "u_001")
        self.assertEqual(unreachable.shortcut_id, "sc_001")
        self.assertEqual(unreachable.reason, "修饰键过多")


class TestDuplicateMacro(unittest.TestCase):
    """测试重复宏模型"""
    
    def test_create_duplicate(self):
        """测试创建重复宏"""
        duplicate = DuplicateMacro(
            id="d_001",
            macro_id="copy_paste",
            is_exact=True,
            similarity=1.0,
            shortcuts=["sc_001", "sc_002"],
        )
        
        self.assertEqual(duplicate.id, "d_001")
        self.assertEqual(duplicate.macro_id, "copy_paste")
        self.assertTrue(duplicate.is_exact)
        self.assertEqual(duplicate.similarity, 1.0)


class TestConflictType(unittest.TestCase):
    """测试冲突类型枚举"""
    
    def test_enum_values(self):
        """测试枚举值"""
        self.assertEqual(ConflictType.SAME_KEY.value, "same_key")
        self.assertEqual(ConflictType.SYSTEM_RESERVED.value, "system_reserved")
        self.assertEqual(ConflictType.USER_RESERVED.value, "user_reserved")
        self.assertEqual(ConflictType.PARTIAL_MATCH.value, "partial_match")


class TestConflictSeverity(unittest.TestCase):
    """测试严重程度枚举"""
    
    def test_enum_values(self):
        """测试枚举值"""
        self.assertEqual(ConflictSeverity.CRITICAL.value, "critical")
        self.assertEqual(ConflictSeverity.HIGH.value, "high")
        self.assertEqual(ConflictSeverity.MEDIUM.value, "medium")
        self.assertEqual(ConflictSeverity.LOW.value, "low")
        self.assertEqual(ConflictSeverity.INFO.value, "info")


if __name__ == "__main__":
    unittest.main()
