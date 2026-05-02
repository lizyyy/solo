"""解析器工厂 - 根据文件类型或应用程序选择正确的解析器"""

from typing import List, Optional, Type, Dict
from pathlib import Path

from src.parsers.base_parser import BaseParser, ParseResult
from src.parsers.json_parser import JSONParser
from src.parsers.csv_parser import CSVParser
from src.parsers.vscode_parser import VSCodeParser
from src.parsers.figma_parser import FigmaParser
from src.parsers.photoshop_parser import PhotoshopParser
from src.parsers.browser_plugin_parser import BrowserPluginParser


class ParserFactory:
    """解析器工厂类"""
    
    def __init__(self):
        # 注册所有可用的解析器
        self.parsers: List[Type[BaseParser]] = [
            VSCodeParser,
            FigmaParser,
            PhotoshopParser,
            BrowserPluginParser,
            JSONParser,
            CSVParser,
        ]
        
        # 应用程序名称到解析器的映射
        self.application_parsers: Dict[str, Type[BaseParser]] = {
            "vscode": VSCodeParser,
            "visual studio code": VSCodeParser,
            "figma": FigmaParser,
            "photoshop": PhotoshopParser,
            "ps": PhotoshopParser,
            "adobe photoshop": PhotoshopParser,
            "chrome": BrowserPluginParser,
            "firefox": BrowserPluginParser,
            "edge": BrowserPluginParser,
            "safari": BrowserPluginParser,
            "browser": BrowserPluginParser,
            "extension": BrowserPluginParser,
            "plugin": BrowserPluginParser,
        }
    
    def get_parser_for_file(self, file_path: str) -> Optional[BaseParser]:
        """根据文件路径获取合适的解析器"""
        # 首先尝试特定应用的解析器
        for parser_class in self.parsers:
            parser = parser_class()
            if parser.can_parse(file_path):
                return parser
        
        # 如果没有找到特定的解析器，使用通用解析器
        ext = Path(file_path).suffix.lower().lstrip(".")
        
        if ext == "json":
            return JSONParser()
        elif ext == "csv":
            return CSVParser()
        
        return None
    
    def get_parser_for_application(self, application_name: str) -> Optional[BaseParser]:
        """根据应用程序名称获取解析器"""
        app_lower = application_name.lower().strip()
        
        # 直接查找映射
        if app_lower in self.application_parsers:
            parser_class = self.application_parsers[app_lower]
            return parser_class()
        
        # 部分匹配
        for keyword, parser_class in self.application_parsers.items():
            if keyword in app_lower:
                return parser_class()
        
        return None
    
    def get_all_parsers(self) -> List[Type[BaseParser]]:
        """获取所有注册的解析器"""
        return self.parsers
    
    def parse_file(self, file_path: str, application_name: Optional[str] = None) -> ParseResult:
        """解析文件，自动选择合适的解析器"""
        parser = None
        
        # 如果指定了应用程序名称，优先使用对应的解析器
        if application_name:
            parser = self.get_parser_for_application(application_name)
        
        # 如果没有指定应用程序或应用程序解析器不可用，尝试根据文件路径选择
        if not parser:
            parser = self.get_parser_for_file(file_path)
        
        # 如果还是没有解析器，返回错误
        if not parser:
            return ParseResult(
                success=False,
                error_message=f"找不到适合文件的解析器: {file_path}",
                source_file=file_path,
                parser_name="None",
            )
        
        # 使用解析器解析文件
        return parser.parse(file_path)


# 全局单例
_factory_instance: Optional[ParserFactory] = None


def get_parser_factory() -> ParserFactory:
    """获取解析器工厂单例"""
    global _factory_instance
    if _factory_instance is None:
        _factory_instance = ParserFactory()
    return _factory_instance


def get_parser_for_file(file_path: str) -> Optional[BaseParser]:
    """根据文件路径获取解析器（快捷函数）"""
    return get_parser_factory().get_parser_for_file(file_path)


def get_parser_for_application(application_name: str) -> Optional[BaseParser]:
    """根据应用程序名称获取解析器（快捷函数）"""
    return get_parser_factory().get_parser_for_application(application_name)


def parse_file(file_path: str, application_name: Optional[str] = None) -> ParseResult:
    """解析文件（快捷函数）"""
    return get_parser_factory().parse_file(file_path, application_name)
