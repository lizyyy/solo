"""CSV解析器 - 基础CSV格式解析"""

import csv
from typing import Dict, Any, List, Optional
from pathlib import Path
import io

from src.parsers.base_parser import BaseParser, ParseResult
from src.models import Application, Context, Shortcut, ShortcutKey


class CSVParser(BaseParser):
    """基础CSV解析器"""
    
    def __init__(self):
        super().__init__()
        self.supported_extensions = ["csv"]
        self.application_name = "Generic CSV"
        
        # 常见的CSV列名映射
        self.column_mappings = {
            "name": ["name", "command", "action", "功能", "快捷键名称", "操作"],
            "key": ["key", "shortcut", "binding", "快捷键", "组合键", "按键"],
            "description": ["description", "title", "说明", "描述"],
            "context": ["context", "scope", "上下文", "作用域"],
            "platform": ["platform", "os", "平台"],
            "macro": ["macro", "commands", "宏", "宏命令"],
        }
    
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        ext = self._get_file_extension(file_path)
        return ext in self.supported_extensions
    
    def parse(self, file_path: str) -> ParseResult:
        """解析CSV文件"""
        result = ParseResult(
            source_file=file_path,
            parser_name="CSVParser",
        )
        
        try:
            # 读取CSV文件
            rows = []
            with open(file_path, 'r', encoding='utf-8') as f:
                # 尝试自动检测CSV方言
                content = f.read()
                dialect = csv.Sniffer().sniff(content) if content.strip() else csv.excel
                f.seek(0)
                reader = csv.DictReader(f, dialect=dialect)
                rows = list(reader)
            
            if not rows:
                result.warnings.append("CSV文件为空")
                result.success = True
                return result
            
            # 解析列名映射
            column_map = self._detect_columns(rows[0].keys() if rows else [])
            
            # 创建应用程序
            app_name = self._extract_application_name(file_path, rows)
            app = Application(
                name=app_name,
                display_name=app_name,
                source_file=file_path,
                import_time=__import__('time').time(),
            )
            result.application = app
            
            # 创建默认上下文
            default_ctx = self._create_default_context(app.id)
            result.contexts = [default_ctx]
            
            # 解析快捷键
            shortcuts = []
            for row in rows:
                shortcut = self._parse_row(row, column_map, app.id, default_ctx.id)
                if shortcut:
                    shortcuts.append(shortcut)
            
            result.shortcuts = shortcuts
            
            # 更新上下文的快捷键列表
            default_ctx.shortcut_ids = [s.id for s in shortcuts]
            app.context_ids = [default_ctx.id]
            
            result.success = True
            
        except Exception as e:
            result.success = False
            result.error_message = f"解析CSV文件失败: {str(e)}"
        
        return result
    
    def _detect_columns(self, headers: List[str]) -> Dict[str, str]:
        """检测列名映射"""
        column_map = {}
        
        for target_col, possible_names in self.column_mappings.items():
            for header in headers:
                header_lower = header.lower().strip()
                for possible in possible_names:
                    if possible.lower() in header_lower or header_lower == possible.lower():
                        column_map[target_col] = header
                        break
                if target_col in column_map:
                    break
        
        return column_map
    
    def _extract_application_name(self, file_path: str, rows: List[Dict]) -> str:
        """从文件路径或内容提取应用程序名称"""
        # 从文件名推断
        filename = Path(file_path).stem.lower()
        
        # 常见应用程序名称
        app_keywords = {
            "figma": "Figma",
            "photoshop": "Photoshop",
            "ps": "Photoshop",
            "vscode": "VS Code",
            "code": "VS Code",
            "chrome": "Chrome",
            "firefox": "Firefox",
            "browser": "Browser",
        }
        
        for keyword, app_name in app_keywords.items():
            if keyword in filename:
                return app_name
        
        # 检查第一行是否有应用程序信息
        if rows:
            first_row = rows[0]
            for key, value in first_row.items():
                if "application" in key.lower() or "app" in key.lower():
                    return value
        
        return "Unknown Application"
    
    def _parse_row(
        self, 
        row: Dict[str, str], 
        column_map: Dict[str, str], 
        app_id: str, 
        default_ctx_id: str
    ) -> Optional[Shortcut]:
        """解析单行CSV数据"""
        # 从列映射获取值
        def get_value(target: str) -> str:
            if target in column_map and column_map[target] in row:
                return row[column_map[target]].strip()
            # 尝试直接从键名查找
            for key, value in row.items():
                if target.lower() in key.lower():
                    return value.strip()
            return ""
        
        name = get_value("name")
        key_str = get_value("key")
        description = get_value("description")
        context = get_value("context")
        platform = get_value("platform")
        macro_str = get_value("macro")
        
        if not name and not key_str:
            return None
        
        # 创建快捷键对象
        shortcut = Shortcut(
            name=name or "Unknown",
            description=description,
            application_id=app_id,
            context_id=context or default_ctx_id,
            source_file="",
            source_format="csv",
            import_time=__import__('time').time(),
        )
        
        # 解析快捷键
        if key_str:
            try:
                shortcut.primary_key = ShortcutKey.from_string(key_str)
            except Exception:
                pass
        
        # 解析宏
        if macro_str:
            shortcut.is_macro = True
            shortcut.macro_commands = [c.strip() for c in macro_str.split(";") if c.strip()]
        
        # 平台信息
        if platform:
            shortcut.platform = platform.lower()
            shortcut.is_platform_specific = platform.lower() != "all"
        
        return shortcut
    
    def parse_string(self, content: str) -> ParseResult:
        """从字符串解析CSV"""
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        try:
            result = self.parse(temp_path)
        finally:
            os.unlink(temp_path)
        
        return result
