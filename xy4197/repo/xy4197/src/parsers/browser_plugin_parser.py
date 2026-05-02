"""浏览器插件快捷键解析器"""

import json
import csv
from typing import Dict, Any, List, Optional
from pathlib import Path
import io

from src.parsers.base_parser import BaseParser, ParseResult
from src.parsers.json_parser import JSONParser
from src.models import Application, Context, Shortcut, ShortcutKey


class BrowserPluginParser(JSONParser):
    """浏览器插件快捷键解析器 - 支持 Chrome、Firefox 等浏览器插件"""
    
    def __init__(self):
        super().__init__()
        self.application_name = "Browser Plugin"
        self.supported_extensions = ["json", "csv"]
        
        # 已知的浏览器和插件
        self.known_browsers = {
            "chrome": "Google Chrome",
            "chromium": "Chromium",
            "firefox": "Mozilla Firefox",
            "edge": "Microsoft Edge",
            "safari": "Safari",
        }
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        if not super().can_parse(file_path):
            return False
        
        # 检查文件名
        filename = Path(file_path).stem.lower()
        browser_keywords = ["chrome", "chromium", "firefox", "edge", "safari", "browser", "extension", "plugin"]
        for kw in browser_keywords:
            if kw in filename:
                return True
        
        # 检查文件内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                sample = f.read(3000)
                # 检查是否包含浏览器插件特有的字段
                if "extension" in sample.lower() or "plugin" in sample.lower():
                    return True
                # Chrome 扩展的 manifest.json 格式
                if "\"manifest_version\"" in sample and "\"commands\"" in sample:
                    return True
        except Exception:
            pass
        
        return False
    
    def parse(self, file_path: str) -> ParseResult:
        """解析浏览器插件快捷键文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="BrowserPluginParser",
        )
        
        ext = self._get_file_extension(file_path)
        
        try:
            # 检测浏览器类型
            browser_name = self._detect_browser(file_path)
            
            # 创建应用程序
            app = Application(
                name=f"{browser_name} Extension",
                display_name=f"{browser_name} 扩展",
                vendor="",
                version="",
                description=f"{browser_name} 浏览器扩展快捷键配置",
                source_file=file_path,
                import_time=__import__('time').time(),
                supported_platforms=["mac", "windows", "linux"],
            )
            result.application = app
            
            # 创建上下文
            contexts = self._create_contexts(app.id)
            result.contexts = contexts
            
            # 解析快捷键
            shortcuts = []
            
            if ext == "json":
                shortcuts = self._parse_json_file(file_path, app.id, contexts, browser_name)
            elif ext == "csv":
                shortcuts = self._parse_csv_file(file_path, app.id, contexts)
            
            result.shortcuts = shortcuts
            
            # 更新上下文和应用的引用
            for ctx in contexts:
                ctx.shortcut_ids = [s.id for s in shortcuts if s.context_id == ctx.id]
            app.context_ids = [c.id for c in contexts]
            
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"解析浏览器插件快捷键文件失败: {str(e)}"
        
        return result
    
    def _detect_browser(self, file_path: str) -> str:
        """从文件路径或内容检测浏览器类型"""
        filename = Path(file_path).stem.lower()
        
        for keyword, name in self.known_browsers.items():
            if keyword in filename:
                return name
        
        # 尝试从内容检测
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().lower()
                for keyword, name in self.known_browsers.items():
                    if keyword in content:
                        return name
        except Exception:
            pass
        
        return "Browser"
    
    def _create_contexts(self, app_id: str) -> List[Context]:
        """创建浏览器插件的上下文"""
        contexts = []
        
        # 全局上下文
        global_ctx = Context(
            name="global",
            display_name="全局",
            description="浏览器全局快捷键",
            application_id=app_id,
            is_global=True,
            priority=200,
        )
        contexts.append(global_ctx)
        
        # 扩展上下文
        extension_ctx = Context(
            name="extension",
            display_name="扩展",
            description="浏览器扩展快捷键",
            application_id=app_id,
            priority=180,
        )
        contexts.append(extension_ctx)
        
        # 开发者工具上下文
        devtools_ctx = Context(
            name="devtools",
            display_name="开发者工具",
            description="开发者工具快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(devtools_ctx)
        
        return contexts
    
    def _parse_json_file(
        self, 
        file_path: str, 
        app_id: str, 
        contexts: List[Context],
        browser_name: str
    ) -> List[Shortcut]:
        """解析 JSON 格式的浏览器插件快捷键文件"""
        shortcuts = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Chrome 扩展的 manifest.json 格式:
            # {
            #   "manifest_version": 3,
            #   "commands": {
            #     "toggle-feature": {
            #       "suggested_key": {
            #         "default": "Ctrl+Shift+Y",
            #         "mac": "Command+Shift+Y"
            #       },
            #       "description": "Toggle feature"
            #     }
            #   }
            # }
            
            if "commands" in data and isinstance(data["commands"], dict):
                # Chrome 扩展 manifest 格式
                for command_name, command_info in data["commands"].items():
                    if isinstance(command_info, dict):
                        shortcut = self._parse_chrome_command(
                            command_name, command_info, app_id, contexts
                        )
                        if shortcut:
                            shortcuts.append(shortcut)
            
            # 其他 JSON 格式
            elif "shortcuts" in data and isinstance(data["shortcuts"], list):
                for item in data["shortcuts"]:
                    if isinstance(item, dict):
                        shortcut = self._parse_shortcut_item(item, app_id, contexts)
                        if shortcut:
                            shortcuts.append(shortcut)
            
            # 简单的键值对格式
            elif isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, dict) and "key" in value:
                        shortcut = self._parse_key_value_shortcut(key, value, app_id, contexts)
                        if shortcut:
                            shortcuts.append(shortcut)
        
        except Exception as e:
            print(f"Error parsing browser plugin JSON: {e}")
        
        return shortcuts
    
    def _parse_chrome_command(
        self,
        command_name: str,
        command_info: Dict[str, Any],
        app_id: str,
        contexts: List[Context]
    ) -> Optional[Shortcut]:
        """解析 Chrome 扩展的命令"""
        suggested_key = command_info.get("suggested_key", {})
        description = command_info.get("description", "")
        
        # 获取快捷键 - 优先使用当前平台
        key_str = ""
        
        # 尝试获取平台特定的快捷键
        import sys
        current_platform = sys.platform
        
        if current_platform == "darwin":
            # Mac
            if "mac" in suggested_key:
                key_str = suggested_key["mac"]
        elif current_platform == "win32":
            # Windows
            if "windows" in suggested_key:
                key_str = suggested_key["windows"]
        elif current_platform.startswith("linux"):
            # Linux
            if "linux" in suggested_key:
                key_str = suggested_key["linux"]
        
        # 如果没有平台特定的，使用默认
        if not key_str and "default" in suggested_key:
            key_str = suggested_key["default"]
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=command_name,
            description=description or f"Command: {command_name}",
            action=command_name,
            application_id=app_id,
            context_id=contexts[1].id if len(contexts) > 1 else contexts[0].id,  # 扩展上下文
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        if key_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_shortcut_item(
        self,
        item: Dict[str, Any],
        app_id: str,
        contexts: List[Context]
    ) -> Optional[Shortcut]:
        """解析列表格式的快捷键"""
        name = item.get("name", item.get("command", item.get("action", "")))
        key_str = item.get("key", item.get("shortcut", item.get("binding", "")))
        description = item.get("description", "")
        context = item.get("context", item.get("scope", ""))
        
        if not name and not key_str:
            return None
        
        # 确定上下文
        context_id = contexts[0].id  # 默认全局
        if context:
            context_lower = context.lower()
            if "extension" in context_lower or "plugin" in context_lower:
                context_id = contexts[1].id if len(contexts) > 1 else context_id
            elif "devtool" in context_lower or "developer" in context_lower:
                context_id = contexts[2].id if len(contexts) > 2 else context_id
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name or "Unknown",
            description=description,
            action=name,
            application_id=app_id,
            context_id=context_id,
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        if key_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_key_value_shortcut(
        self,
        key: str,
        value: Dict[str, Any],
        app_id: str,
        contexts: List[Context]
    ) -> Optional[Shortcut]:
        """解析键值对格式的快捷键"""
        key_str = value.get("key", value.get("shortcut", ""))
        name = value.get("name", key)
        description = value.get("description", "")
        
        if not key_str:
            return None
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name or "Unknown",
            description=description,
            action=name,
            application_id=app_id,
            context_id=contexts[0].id,
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        if key_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_csv_file(
        self,
        file_path: str,
        app_id: str,
        contexts: List[Context]
    ) -> List[Shortcut]:
        """解析 CSV 格式的浏览器插件快捷键文件"""
        shortcuts = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            for row in rows:
                # 尝试从不同的列名获取值
                name = row.get("Name", row.get("Command", row.get("Action", "")))
                key_str = row.get("Key", row.get("Shortcut", row.get("Binding", "")))
                description = row.get("Description", row.get("Desc", ""))
                
                if not name and not key_str:
                    continue
                
                # 创建快捷键对象
                shortcut = Shortcut(
                    name=name or "Unknown",
                    description=description,
                    action=name,
                    application_id=app_id,
                    context_id=contexts[0].id,
                    source_file="",
                    source_format="csv",
                    import_time=__import__('time').time(),
                )
                
                if key_str:
                    try:
                        shortcut.primary_key = ShortcutKey.from_string(key_str)
                    except Exception:
                        pass
                
                shortcuts.append(shortcut)
        
        except Exception as e:
            print(f"Error parsing browser plugin CSV: {e}")
        
        return shortcuts
