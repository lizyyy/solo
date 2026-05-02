"""Photoshop 快捷键解析器"""

import json
import csv
from typing import Dict, Any, List, Optional
from pathlib import Path
import io

from src.parsers.base_parser import BaseParser, ParseResult
from src.parsers.csv_parser import CSVParser
from src.models import Application, Context, Shortcut, ShortcutKey


class PhotoshopParser(CSVParser):
    """Photoshop 快捷键解析器"""
    
    def __init__(self):
        super().__init__()
        self.application_name = "Photoshop"
        self.supported_extensions = ["csv", "txt", "kys"]
        
        # Photoshop 已知的菜单/工作区
        self.known_workspaces = {
            "Application": "应用程序",
            "Panel": "面板",
            "Tools": "工具",
            "Type Tool": "文字工具",
        }
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        ext = self._get_file_extension(file_path)
        
        # 检查扩展名
        supported_exts = ["csv", "txt", "kys"]
        if ext not in supported_exts:
            return False
        
        # 检查文件名
        filename = Path(file_path).stem.lower()
        photoshop_keywords = ["photoshop", "ps", "adobe"]
        for kw in photoshop_keywords:
            if kw in filename:
                return True
        
        # 检查文件内容
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                sample = f.read(3000)
                # Photoshop 导出的CSV通常有特定的列名
                if "Shortcut" in sample or "Command" in sample or "Photoshop" in sample:
                    return True
                # .kys 文件是 Photoshop 的键盘快捷键文件
                if ext == "kys":
                    return True
        except Exception:
            pass
        
        return False
    
    def parse(self, file_path: str) -> ParseResult:
        """解析 Photoshop 快捷键文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="PhotoshopParser",
        )
        
        ext = self._get_file_extension(file_path)
        
        try:
            # 创建 Photoshop 应用程序
            app = Application(
                name="Photoshop",
                display_name="Adobe Photoshop",
                vendor="Adobe",
                version="",
                description="Adobe Photoshop 快捷键配置",
                source_file=file_path,
                import_time=__import__('time').time(),
                supported_platforms=["mac", "windows"],
            )
            result.application = app
            
            # 创建上下文
            contexts = self._create_contexts(app.id)
            result.contexts = contexts
            
            # 根据扩展名选择解析方式
            shortcuts = []
            
            if ext == "kys":
                # .kys 文件是二进制格式，我们暂时不支持完全解析
                # 但可以尝试解析其中的文本部分
                shortcuts = self._parse_kys_file(file_path, app.id, contexts)
            else:
                # CSV 或 TXT 格式
                shortcuts = self._parse_csv_file(file_path, app.id, contexts)
            
            result.shortcuts = shortcuts
            
            # 更新上下文和应用的引用
            for ctx in contexts:
                ctx.shortcut_ids = [s.id for s in shortcuts if s.context_id == ctx.id]
            app.context_ids = [c.id for c in contexts]
            
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"解析Photoshop快捷键文件失败: {str(e)}"
        
        return result
    
    def _create_contexts(self, app_id: str) -> List[Context]:
        """创建 Photoshop 的上下文"""
        contexts = []
        
        # 全局上下文
        global_ctx = Context(
            name="global",
            display_name="应用程序",
            description="Photoshop 应用程序快捷键",
            application_id=app_id,
            is_global=True,
            priority=200,
        )
        contexts.append(global_ctx)
        
        # 工具上下文
        tools_ctx = Context(
            name="tools",
            display_name="工具",
            description="Photoshop 工具快捷键",
            application_id=app_id,
            priority=180,
        )
        contexts.append(tools_ctx)
        
        # 面板上下文
        panels_ctx = Context(
            name="panels",
            display_name="面板",
            description="Photoshop 面板快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(panels_ctx)
        
        # 滤镜上下文
        filters_ctx = Context(
            name="filters",
            display_name="滤镜",
            description="Photoshop 滤镜快捷键",
            application_id=app_id,
            priority=150,
        )
        contexts.append(filters_ctx)
        
        return contexts
    
    def _parse_csv_file(
        self, 
        file_path: str, 
        app_id: str, 
        contexts: List[Context]
    ) -> List[Shortcut]:
        """解析 CSV 格式的 Photoshop 快捷键文件"""
        shortcuts = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 尝试不同的解析方式
            # Photoshop 导出的CSV可能有不同的格式
            
            # 方式1: 标准CSV
            try:
                reader = csv.DictReader(io.StringIO(content))
                rows = list(reader)
                
                if rows and len(rows) > 0:
                    # 检查是否有标准列
                    headers = rows[0].keys()
                    
                    for row in rows:
                        shortcut = self._parse_csv_row(row, app_id, contexts)
                        if shortcut:
                            shortcuts.append(shortcut)
                    
                    if shortcuts:
                        return shortcuts
            except Exception:
                pass
            
            # 方式2: 制表符分隔或自定义格式
            lines = content.strip().split('\n')
            if lines:
                # 检查第一行是否是标题
                first_line = lines[0].lower()
                
                if "shortcut" in first_line or "command" in first_line or "key" in first_line:
                    # 有标题行
                    data_lines = lines[1:]
                else:
                    # 无标题行
                    data_lines = lines
                
                for line in data_lines:
                    if not line.strip():
                        continue
                    
                    # 尝试用逗号或制表符分割
                    if '\t' in line:
                        parts = line.split('\t')
                    else:
                        parts = line.split(',')
                    
                    # 清理各部分
                    parts = [p.strip().strip('"') for p in parts]
                    
                    # 尝试提取快捷键信息
                    # 格式可能是: Command, Shortcut, [Context]
                    name = ""
                    shortcut_str = ""
                    context_str = ""
                    
                    for i, part in enumerate(parts):
                        if "+" in part or ("Ctrl" in part or "Cmd" in part or "Alt" in part or "Shift" in part):
                            # 可能是快捷键
                            shortcut_str = part
                            # 名称可能在前面
                            if i > 0:
                                name = parts[i-1]
                            break
                        elif i == 0 and part:
                            name = part
                    
                    if name or shortcut_str:
                        shortcut = Shortcut(
                            name=name or "Unknown",
                            description=f"Command: {name}",
                            action=name,
                            application_id=app_id,
                            context_id=contexts[0].id,
                            source_file="",
                            source_format="csv",
                            import_time=__import__('time').time(),
                        )
                        
                        if shortcut_str:
                            try:
                                shortcut.primary_key = ShortcutKey.from_string(shortcut_str)
                            except Exception:
                                pass
                        
                        shortcuts.append(shortcut)
        
        except Exception as e:
            print(f"Error parsing Photoshop CSV: {e}")
        
        return shortcuts
    
    def _parse_csv_row(
        self, 
        row: Dict[str, str], 
        app_id: str, 
        contexts: List[Context]
    ) -> Optional[Shortcut]:
        """解析单行 CSV 数据"""
        # 尝试从不同的列名获取值
        name = ""
        shortcut_str = ""
        context_str = ""
        
        # 可能的列名映射
        name_columns = ["Command", "command", "Name", "name", "Action", "action"]
        shortcut_columns = ["Shortcut", "shortcut", "Key", "key", "Binding", "binding"]
        context_columns = ["Context", "context", "Scope", "scope", "Workspace", "workspace"]
        
        for col in name_columns:
            if col in row and row[col]:
                name = row[col]
                break
        
        for col in shortcut_columns:
            if col in row and row[col]:
                shortcut_str = row[col]
                break
        
        for col in context_columns:
            if col in row and row[col]:
                context_str = row[col]
                break
        
        if not name and not shortcut_str:
            return None
        
        # 确定上下文
        context_id = contexts[0].id  # 默认全局
        if context_str:
            context_lower = context_str.lower()
            if "tool" in context_lower:
                context_id = contexts[1].id if len(contexts) > 1 else context_id
            elif "panel" in context_lower:
                context_id = contexts[2].id if len(contexts) > 2 else context_id
            elif "filter" in context_lower:
                context_id = contexts[3].id if len(contexts) > 3 else context_id
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name or "Unknown",
            description=f"Command: {name}",
            action=name,
            application_id=app_id,
            context_id=context_id,
            source_file="",
            source_format="csv",
            import_time=__import__('time').time(),
        )
        
        # 解析快捷键
        if shortcut_str:
            try:
                # Photoshop 格式可能是: Ctrl+Alt+Z 或 Cmd+Option+Z
                shortcut.primary_key = ShortcutKey.from_string(shortcut_str)
            except Exception:
                pass
        
        return shortcut
    
    def _parse_kys_file(
        self, 
        file_path: str, 
        app_id: str, 
        contexts: List[Context]
    ) -> List[Shortcut]:
        """解析 .kys 格式的 Photoshop 快捷键文件（简化版）"""
        # .kys 文件是二进制格式，这里提供一个简化的解析
        # 实际使用中可能需要更复杂的解析
        
        shortcuts = []
        
        try:
            # 尝试以文本方式读取，寻找可能的快捷键信息
            with open(file_path, 'rb') as f:
                data = f.read()
            
            # 尝试解码为文本
            try:
                text = data.decode('utf-8', errors='ignore')
            except Exception:
                text = data.decode('latin-1', errors='ignore')
            
            # 寻找可能的快捷键模式
            import re
            # 寻找类似 "Ctrl+..." 或 "Cmd+..." 的模式
            shortcut_pattern = r'(?:Ctrl|Cmd|Alt|Option|Shift)\+[A-Za-z0-9]+'
            matches = re.findall(shortcut_pattern, text)
            
            # 简单创建一些占位快捷键
            # 实际的 .kys 解析需要更复杂的处理
            if matches:
                # 添加警告
                pass
            
        except Exception as e:
            print(f"Error parsing .kys file: {e}")
        
        return shortcuts
