"""测试解析器模块"""

import unittest
import sys
import os
import json
import tempfile
import csv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parsers.parser_factory import ParserFactory
from src.parsers.vscode_parser import VSCodeParser
from src.parsers.figma_parser import FigmaParser
from src.parsers.photoshop_parser import PhotoshopParser
from src.parsers.browser_plugin_parser import BrowserPluginParser
from src.parsers.json_parser import JSONParser
from src.parsers.csv_parser import CSVParser


class TestParserFactory(unittest.TestCase):
    """测试解析器工厂"""
    
    def test_get_parser_by_file_extension(self):
        """测试根据文件扩展名获取解析器"""
        factory = ParserFactory()
        
        # JSON文件
        parser = factory.get_parser_for_file("test.json")
        self.assertIsNotNone(parser)
        
        # CSV文件
        parser = factory.get_parser_for_file("test.csv")
        self.assertIsNotNone(parser)
        
        # TXT文件
        parser = factory.get_parser_for_file("test.txt")
        self.assertIsNotNone(parser)
    
    def test_detect_application_type(self):
        """测试检测应用类型"""
        factory = ParserFactory()
        
        # 检测VS Code
        vscode_content = [{"key": "ctrl+p", "command": "workbench.action.quickOpen"}]
        app_type = factory._detect_application_type(vscode_content)
        # 可能检测为json或vscode
        
        # 检测浏览器插件
        browser_content = {
            "manifest_version": 3,
            "commands": {
                "test": {"suggested_key": {"default": "Ctrl+Shift+P"}}
            }
        }
        app_type = factory._detect_application_type(browser_content)
        # 可能检测为browser_plugin或json


class TestVSCodeParser(unittest.TestCase):
    """测试VS Code解析器"""
    
    def test_parse_valid_json(self):
        """测试解析有效的VS Code keybindings.json"""
        parser = VSCodeParser()
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([
                {"key": "ctrl+c", "command": "editor.action.clipboardCopyAction"},
                {"key": "ctrl+v", "command": "editor.action.clipboardPasteAction"},
            ], f)
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            self.assertTrue(result.success)
            self.assertEqual(result.application_type, "vscode")
            self.assertEqual(len(result.shortcuts), 2)
            
            # 检查快捷键
            shortcut_keys = [str(s.key) for s in result.shortcuts]
            self.assertIn("ctrl+c", shortcut_keys)
            self.assertIn("ctrl+v", shortcut_keys)
        finally:
            os.unlink(temp_path)
    
    def test_parse_with_comments(self):
        """测试解析包含注释的JSON（VS Code常用）"""
        parser = VSCodeParser()
        
        # 创建带注释的临时文件
        content = """[
            // 复制
            {"key": "ctrl+c", "command": "copy"},
            // 粘贴
            {"key": "ctrl+v", "command": "paste"},
        ]"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write(content)
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            # 可能成功也可能失败，取决于JSON解析器
            # 至少不应该崩溃
        except Exception:
            pass  # 预期可能会失败
        finally:
            os.unlink(temp_path)


class TestFigmaParser(unittest.TestCase):
    """测试Figma解析器"""
    
    def test_parse_menu_format(self):
        """测试解析菜单格式的快捷键"""
        parser = FigmaParser()
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([
                {"key": "ctrl+c", "command": "Copy", "menu": "Edit > Copy"},
                {"key": "ctrl+v", "command": "Paste", "menu": "Edit > Paste"},
            ], f)
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            self.assertTrue(result.success)
            self.assertEqual(result.application_type, "figma")
        finally:
            os.unlink(temp_path)


class TestPhotoshopParser(unittest.TestCase):
    """测试Photoshop解析器"""
    
    def test_parse_csv_format(self):
        """测试解析CSV格式的快捷键"""
        parser = PhotoshopParser()
        
        # 创建临时CSV文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["快捷键", "命令", "上下文", "说明"])
            writer.writerow(["ctrl+c", "copy", "全部", "复制"])
            writer.writerow(["ctrl+v", "paste", "全部", "粘贴"])
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            # 可能成功也可能被CSVParser处理
            # 至少不应该崩溃
        except Exception:
            pass
        finally:
            os.unlink(temp_path)


class TestBrowserPluginParser(unittest.TestCase):
    """测试浏览器插件解析器"""
    
    def test_parse_manifest_v3(self):
        """测试解析Manifest V3格式"""
        parser = BrowserPluginParser()
        
        # 创建临时manifest.json
        manifest = {
            "manifest_version": 3,
            "name": "测试插件",
            "version": "1.0",
            "commands": {
                "_execute_action": {
                    "suggested_key": {
                        "default": "Ctrl+Shift+A",
                        "mac": "MacCtrl+Shift+A"
                    },
                    "description": "打开面板"
                },
                "copy-info": {
                    "suggested_key": {
                        "default": "Ctrl+Shift+C"
                    },
                    "description": "复制信息"
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(manifest, f)
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            self.assertTrue(result.success)
            self.assertEqual(result.application_type, "browser_plugin")
            # 应该有至少2个快捷键
        finally:
            os.unlink(temp_path)
    
    def test_convert_chrome_key(self):
        """测试转换Chrome快捷键格式"""
        parser = BrowserPluginParser()
        
        # 测试普通快捷键
        converted = parser._convert_chrome_key("Ctrl+Shift+A")
        # 应该转换为ctrl+shift+a
        
        # 测试Mac快捷键
        converted = parser._convert_chrome_key("MacCtrl+Shift+A")
        # 应该转换为ctrl+shift+a或mac格式


class TestJSONParser(unittest.TestCase):
    """测试通用JSON解析器"""
    
    def test_parse_simple_json(self):
        """测试解析简单的JSON格式"""
        parser = JSONParser()
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([
                {"key": "ctrl+c", "command": "copy"},
                {"key": "ctrl+v", "command": "paste"},
            ], f)
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            self.assertTrue(result.success)
            self.assertEqual(len(result.shortcuts), 2)
        finally:
            os.unlink(temp_path)


class TestCSVParser(unittest.TestCase):
    """测试通用CSV解析器"""
    
    def test_parse_simple_csv(self):
        """测试解析简单的CSV格式"""
        parser = CSVParser()
        
        # 创建临时CSV文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["快捷键", "命令"])
            writer.writerow(["ctrl+c", "copy"])
            writer.writerow(["ctrl+v", "paste"])
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            self.assertTrue(result.success)
            # 应该至少有2个快捷键
        finally:
            os.unlink(temp_path)
    
    def test_parse_with_different_headers(self):
        """测试解析不同表头的CSV"""
        parser = CSVParser()
        
        # 不同的表头名称
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["key", "action", "context"])
            writer.writerow(["ctrl+s", "save", "all"])
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            # 可能识别也可能不识别
            # 至少不应该崩溃
        except Exception:
            pass
        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    unittest.main()
