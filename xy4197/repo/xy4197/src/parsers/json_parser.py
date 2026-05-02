"""JSON解析器 - 基础JSON格式解析"""

import json
from typing import Dict, Any, List
from pathlib import Path

from src.parsers.base_parser import BaseParser, ParseResult
from src.models import Application, Context, Shortcut, ShortcutKey


class JSONParser(BaseParser):
    """基础JSON解析器"""
    
    def __init__(self):
        super().__init__()
        self.supported_extensions = ["json"]
        self.application_name = "Generic JSON"
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        ext = self._get_file_extension(file_path)
        return ext in self.supported_extensions
    
    def parse(self, file_path: str) -> ParseResult:
        """解析JSON文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="JSONParser",
        )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 尝试解析为应用程序配置
            app = self._parse_application(data, file_path)
            result.application = app
            
            # 解析上下文
            contexts = self._parse_contexts(data, app.id if app else "")
            result.contexts = contexts
            
            # 解析快捷键
            shortcuts = self._parse_shortcuts(data, app.id if app else "", contexts)
            result.shortcuts = shortcuts
            
            # 更新上下文的快捷键列表
            for ctx in contexts:
                ctx.shortcut_ids = [s.id for s in shortcuts if s.context_id == ctx.id]
            
            # 更新应用的上下文列表
            if app:
                app.context_ids = [c.id for c in contexts]
            
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"解析JSON文件失败: {str(e)}"
        
        return result
    
    def _parse_application(self, data: Dict[str, Any], file_path: str) -> Application:
        """解析应用程序信息"""
        # 尝试从不同的键名获取信息
        app_name = data.get("application", data.get("app", data.get("name", "Unknown Application")))
        app_version = data.get("version", data.get("app_version", ""))
        app_vendor = data.get("vendor", data.get("author", ""))
        app_desc = data.get("description", "")
        
        app = Application(
            name=app_name,
            display_name=app_name,
            version=app_version,
            vendor=app_vendor,
            description=app_desc,
            source_file=file_path,
            import_time=__import__('time').time(),
        )
        
        return app
    
    def _parse_contexts(self, data: Dict[str, Any], app_id: str) -> List[Context]:
        """解析上下文列表"""
        contexts = []
        
        # 检查是否有明确的上下文字段
        if "contexts" in data and isinstance(data["contexts"], list):
            for ctx_data in data["contexts"]:
                ctx = Context(
                    name=ctx_data.get("name", ctx_data.get("id", "unknown")),
                    display_name=ctx_data.get("display_name", ctx_data.get("name", "Unknown")),
                    description=ctx_data.get("description", ""),
                    application_id=app_id,
                    priority=ctx_data.get("priority", 100),
                    is_global=ctx_data.get("is_global", False),
                )
                contexts.append(ctx)
        
        # 如果没有上下文，创建默认上下文
        if not contexts:
            default_ctx = self._create_default_context(app_id)
            contexts.append(default_ctx)
        
        return contexts
    
    def _parse_shortcuts(
        self, 
        data: Dict[str, Any], 
        app_id: str, 
        contexts: List[Context]
    ) -> List[Shortcut]:
        """解析快捷键列表"""
        shortcuts = []
        
        # 确定默认上下文ID
        default_ctx_id = contexts[0].id if contexts else ""
        
        # 尝试从不同的键名获取快捷键
        shortcut_sources = [
            data.get("shortcuts", []),
            data.get("keybindings", []),
            data.get("keys", []),
        ]
        
        # 如果是字典格式（如VS Code的keybindings.json）
        if isinstance(data, list):
            shortcut_sources = [data]
        elif isinstance(data, dict) and "key" in data:
            shortcut_sources = [[data]]
        
        for source in shortcut_sources:
            if not isinstance(source, list):
                continue
            
            for item in source:
                if not isinstance(item, dict):
                    continue
                
                shortcut = self._parse_single_shortcut(item, app_id, default_ctx_id)
                if shortcut:
                    shortcuts.append(shortcut)
        
        return shortcuts
    
    def _parse_single_shortcut(
        self, 
        item: Dict[str, Any], 
        app_id: str, 
        default_ctx_id: str
    ) -> Shortcut:
        """解析单个快捷键"""
        # 尝试从不同的键名获取信息
        name = item.get("name", item.get("command", item.get("action", "Unknown")))
        desc = item.get("description", item.get("title", ""))
        
        # 获取快捷键字符串
        key_str = item.get("key", item.get("shortcut", item.get("binding", "")))
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name,
            description=desc,
            action=item.get("command", item.get("action", "")),
            application_id=app_id,
            context_id=item.get("context_id", item.get("context", default_ctx_id)),
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        # 解析主键
        if key_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                # 忽略解析失败的情况
                pass
        
        # 解析备用键
        alt_keys = item.get("alt", item.get("alternate", []))
        if isinstance(alt_keys, list):
            for alt_key in alt_keys:
                try:
                    if alt_key:
                        shortcut.secondary_keys.append(ShortcutKey.from_string(str(alt_key)))
                except Exception:
                    pass
        elif isinstance(alt_keys, str):
            try:
                shortcut.secondary_keys.append(ShortcutKey.from_string(alt_keys))
            except Exception:
                pass
        
        # 检查是否是宏
        macro_commands = item.get("macro", item.get("commands", []))
        if macro_commands:
            shortcut.is_macro = True
            shortcut.macro_commands = macro_commands if isinstance(macro_commands, list) else [str(macro_commands)]
        
        # 平台信息
        platform = item.get("platform", item.get("os", "all"))
        shortcut.platform = platform
        shortcut.is_platform_specific = platform != "all"
        
        return shortcut
    
    def parse_string(self, content: str) -> ParseResult:
        """从字符串解析JSON"""
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        try:
            result = self.parse(temp_path)
        finally:
            os.unlink(temp_path)
        
        return result
