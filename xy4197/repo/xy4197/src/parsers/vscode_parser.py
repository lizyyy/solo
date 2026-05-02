"""VS Code 快捷键解析器"""

import json
from typing import Dict, Any, List
from pathlib import Path

from src.parsers.json_parser import JSONParser
from src.parsers.base_parser import ParseResult
from src.models import Application, Context, Shortcut, ShortcutKey


class VSCodeParser(JSONParser):
    """VS Code 快捷键解析器"""
    
    def __init__(self):
        super().__init__()
        self.application_name = "VS Code"
        self.supported_extensions = ["json"]
        
        # VS Code 已知的上下文/作用域
        self.known_scopes = {
            "editor": "编辑器",
            "editorTextFocus": "编辑器文本焦点",
            "terminalFocus": "终端焦点",
            "editorWidget": "编辑器小部件",
            "suggestWidget": "建议小部件",
            "searchView": "搜索视图",
            "explorerViewlet": "资源管理器",
            "gitlens": "GitLens",
        }
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        if not super().can_parse(file_path):
            return False
        
        # 检查文件名是否包含 VS Code 相关标识
        filename = Path(file_path).stem.lower()
        vscode_keywords = ["vscode", "code", "keybindings", "keybind"]
        for kw in vscode_keywords:
            if kw in filename:
                return True
        
        # 检查文件内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # VS Code keybindings.json 通常是一个数组
                if content.strip().startswith('['):
                    # 检查是否包含典型的 VS Code 字段
                    sample = content[:2000]
                    if '"key"' in sample or '"command"' in sample or '"when"' in sample:
                        return True
        except Exception:
            pass
        
        return False
    
    def parse(self, file_path: str) -> ParseResult:
        """解析 VS Code 快捷键文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="VSCodeParser",
        )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # VS Code keybindings.json 可能包含注释，需要预处理
                content = f.read()
                # 移除 // 注释
                import re
                content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
                # 移除 /* */ 注释
                content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                
                data = json.loads(content)
            
            # 创建 VS Code 应用程序
            app = Application(
                name="VS Code",
                display_name="Visual Studio Code",
                vendor="Microsoft",
                version="",
                description="VS Code 快捷键配置",
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
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        shortcut = self._parse_vscode_shortcut(item, app.id, contexts)
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
            result.error_message = f"解析VS Code快捷键文件失败: {str(e)}"
        
        return result
    
    def _create_contexts(self, app_id: str) -> List[Context]:
        """创建 VS Code 的上下文"""
        contexts = []
        
        # 全局上下文
        global_ctx = Context(
            name="global",
            display_name="全局",
            description="VS Code 全局快捷键",
            application_id=app_id,
            is_global=True,
            priority=200,
        )
        contexts.append(global_ctx)
        
        # 编辑器上下文
        editor_ctx = Context(
            name="editor",
            display_name="编辑器",
            description="VS Code 编辑器快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(editor_ctx)
        
        # 终端上下文
        terminal_ctx = Context(
            name="terminal",
            display_name="终端",
            description="VS Code 终端快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(terminal_ctx)
        
        return contexts
    
    def _parse_vscode_shortcut(
        self, 
        item: Dict[str, Any], 
        app_id: str, 
        contexts: List[Context]
    ) -> Shortcut:
        """解析单个 VS Code 快捷键"""
        # VS Code 格式:
        # {
        #   "key": "ctrl+shift+p",
        #   "command": "workbench.action.showCommands",
        #   "when": "editorTextFocus",
        #   "args": {}
        # }
        
        command = item.get("command", "")
        key_str = item.get("key", "")
        when = item.get("when", "")
        args = item.get("args", {})
        
        # 确定上下文
        context_id = contexts[0].id  # 默认全局
        if when:
            # 简单的 when 条件解析
            when_lower = when.lower()
            if "editor" in when_lower:
                context_id = contexts[1].id if len(contexts) > 1 else context_id
            elif "terminal" in when_lower:
                context_id = contexts[2].id if len(contexts) > 2 else context_id
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=command or "Unknown Command",
            description=f"Command: {command}",
            action=command,
            application_id=app_id,
            context_id=context_id,
            source_file="",
            source_format="json",
            import_time=__import__('time').time(),
        )
        
        # 解析主键
        if key_str:
            try:
                # VS Code 使用的格式: ctrl+shift+p
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                pass
        
        # 解析参数作为备注
        if args:
            shortcut.user_notes = f"Args: {json.dumps(args, ensure_ascii=False)}"
        
        # 平台特定的快捷键
        # VS Code 支持: "key": "ctrl+k ctrl+s", 或者 "mac": "cmd+k cmd+s"
        if "mac" in item:
            mac_key = item.get("mac", "")
            if mac_key and not shortcut.primary_key:
                try:
                    shortcut.primary_key = ShortcutKey.from_string(mac_key)
                    shortcut.platform = "mac"
                    shortcut.is_platform_specific = True
                except Exception:
                    pass
        
        if "win" in item or "windows" in item:
            win_key = item.get("win", item.get("windows", ""))
            if win_key and not shortcut.primary_key:
                try:
                    shortcut.primary_key = ShortcutKey.from_string(win_key)
                    shortcut.platform = "windows"
                    shortcut.is_platform_specific = True
                except Exception:
                    pass
        
        if "linux" in item:
            linux_key = item.get("linux", "")
            if linux_key and not shortcut.primary_key:
                try:
                    shortcut.primary_key = ShortcutKey.from_string(linux_key)
                    shortcut.platform = "linux"
                    shortcut.is_platform_specific = True
                except Exception:
                    pass
        
        return shortcut
