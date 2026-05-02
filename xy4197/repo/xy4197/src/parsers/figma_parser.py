"""Figma 快捷键解析器"""

import json
from typing import Dict, Any, List
from pathlib import Path

from src.parsers.json_parser import JSONParser
from src.parsers.base_parser import ParseResult
from src.models import Application, Context, Shortcut, ShortcutKey


class FigmaParser(JSONParser):
    """Figma 快捷键解析器"""
    
    def __init__(self):
        super().__init__()
        self.application_name = "Figma"
        self.supported_extensions = ["json"]
        
        # Figma 已知的菜单/上下文
        self.known_menus = {
            "Figma": "Figma 菜单",
            "File": "文件",
            "Edit": "编辑",
            "View": "视图",
            "Object": "对象",
            "Vector": "矢量",
            "Text": "文本",
            "Arrange": "排列",
            "Plugins": "插件",
            "Help": "帮助",
        }
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        if not super().can_parse(file_path):
            return False
        
        # 检查文件名
        filename = Path(file_path).stem.lower()
        figma_keywords = ["figma", "fig"]
        for kw in figma_keywords:
            if kw in filename:
                return True
        
        # 检查文件内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # 检查是否包含 Figma 特有的结构
                sample = content[:3000]
                if '"menus"' in sample or '"shortcuts"' in sample:
                    # 进一步检查 Figma 特有的菜单项
                    if '"Figma"' in sample or '"File"' in sample or '"Edit"' in sample:
                        return True
        except Exception:
            pass
        
        return False
    
    def parse(self, file_path: str) -> ParseResult:
        """解析 Figma 快捷键文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="FigmaParser",
        )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 创建 Figma 应用程序
            app = Application(
                name="Figma",
                display_name="Figma",
                vendor="Figma, Inc.",
                version="",
                description="Figma 设计工具快捷键配置",
                source_file=file_path,
                import_time=__import__('time').time(),
                supported_platforms=["mac", "windows"],
            )
            result.application = app
            
            # 创建上下文
            contexts = self._create_contexts(app.id)
            result.contexts = contexts
            
            # 解析快捷键
            shortcuts = []
            
            # Figma 格式可能有多种:
            # 1. { "menus": { "File": [...], "Edit": [...] } }
            # 2. { "shortcuts": [...] }
            # 3. 简单的键值对格式
            
            if "menus" in data and isinstance(data["menus"], dict):
                # 菜单格式
                for menu_name, menu_items in data["menus"].items():
                    if isinstance(menu_items, list):
                        for item in menu_items:
                            if isinstance(item, dict):
                                shortcut = self._parse_menu_shortcut(item, menu_name, app.id, contexts)
                                if shortcut:
                                    shortcuts.append(shortcut)
            
            elif "shortcuts" in data and isinstance(data["shortcuts"], list):
                # 列表格式
                for item in data["shortcuts"]:
                    if isinstance(item, dict):
                        shortcut = self._parse_shortcut_item(item, app.id, contexts)
                        if shortcut:
                            shortcuts.append(shortcut)
            
            elif isinstance(data, dict):
                # 尝试解析为简单的键值对
                for key, value in data.items():
                    if isinstance(value, dict) and "shortcut" in value:
                        shortcut = self._parse_key_value_shortcut(key, value, app.id, contexts)
                        if shortcut:
                            shortcuts.append(shortcut)
            
            result.shortcuts = shortcuts
            
            # 更新上下文和应用的引用
            for ctx in contexts:
                ctx.shortcut_ids = [s.id for s in shortcuts if s.context_id == ctx.id]
            app.context_ids = [c.id for c in contexts]
            
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"解析Figma快捷键文件失败: {str(e)}"
        
        return result
    
    def _create_contexts(self, app_id: str) -> List[Context]:
        """创建 Figma 的上下文"""
        contexts = []
        
        # 全局上下文
        global_ctx = Context(
            name="global",
            display_name="全局",
            description="Figma 全局快捷键",
            application_id=app_id,
            is_global=True,
            priority=200,
        )
        contexts.append(global_ctx)
        
        # 画布/设计上下文
        canvas_ctx = Context(
            name="canvas",
            display_name="画布",
            description="Figma 画布快捷键",
            application_id=app_id,
            priority=180,
        )
        contexts.append(canvas_ctx)
        
        # 图层面板上下文
        layers_ctx = Context(
            name="layers",
            display_name="图层面板",
            description="Figma 图层面板快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(layers_ctx)
        
        # 属性面板上下文
        properties_ctx = Context(
            name="properties",
            display_name="属性面板",
            description="Figma 属性面板快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(properties_ctx)
        
        return contexts
    
    def _parse_menu_shortcut(
        self, 
        item: Dict[str, Any], 
        menu_name: str, 
        app_id: str, 
        contexts: List[Context]
    ) -> Shortcut:
        """解析菜单项中的快捷键"""
        # Figma 菜单项格式:
        # { "name": "New", "shortcut": "Cmd+N", "mac": "Cmd+N", "win": "Ctrl+N" }
        
        name = item.get("name", "")
        shortcut_str = item.get("shortcut", "")
        mac_shortcut = item.get("mac", "")
        win_shortcut = item.get("win", "")
        
        # 确定上下文
        context_id = contexts[0].id  # 默认全局
        # 根据菜单名确定上下文
        menu_lower = menu_name.lower()
        if "object" in menu_lower or "vector" in menu_lower:
            context_id = contexts[1].id if len(contexts) > 1 else context_id  # 画布
        elif "layers" in menu_lower:
            context_id = contexts[2].id if len(contexts) > 2 else context_id  # 图层
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name or "Unknown",
            description=f"菜单: {menu_name} > {name}",
            action=name,
            application_id=app_id,
            context_id=context_id,
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        # 解析快捷键 - 优先使用平台特定的
        if mac_shortcut:
            try:
                shortcut.primary_key = ShortcutKey.from_string(mac_shortcut)
                shortcut.platform = "mac"
                shortcut.is_platform_specific = True
            except Exception:
                pass
        elif win_shortcut:
            try:
                shortcut.primary_key = ShortcutKey.from_string(win_shortcut)
                shortcut.platform = "windows"
                shortcut.is_platform_specific = True
            except Exception:
                pass
        elif shortcut_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(shortcut_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_shortcut_item(
        self, 
        item: Dict[str, Any], 
        app_id: str, 
        contexts: List[Context]
    ) -> Shortcut:
        """解析列表格式的快捷键"""
        name = item.get("name", item.get("command", ""))
        shortcut_str = item.get("key", item.get("shortcut", item.get("binding", "")))
        description = item.get("description", "")
        context = item.get("context", item.get("scope", ""))
        
        # 确定上下文
        context_id = contexts[0].id  # 默认全局
        if context:
            context_lower = context.lower()
            if "canvas" in context_lower or "design" in context_lower:
                context_id = contexts[1].id if len(contexts) > 1 else context_id
            elif "layer" in context_lower:
                context_id = contexts[2].id if len(contexts) > 2 else context_id
            elif "property" in context_lower:
                context_id = contexts[3].id if len(contexts) > 3 else context_id
        
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
        
        if shortcut_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(shortcut_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_key_value_shortcut(
        self, 
        key: str, 
        value: Dict[str, Any], 
        app_id: str, 
        contexts: List[Context]
    ) -> Shortcut:
        """解析键值对格式的快捷键"""
        shortcut_str = value.get("shortcut", "")
        name = value.get("name", key)
        description = value.get("description", "")
        
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
        
        if shortcut_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(shortcut_str)
            except Exception:
                pass
        
        return shortcut
