"""解析器模块"""

from src.parsers.base_parser import BaseParser, ParseResult
from src.parsers.json_parser import JSONParser
from src.parsers.csv_parser import CSVParser
from src.parsers.vscode_parser import VSCodeParser
from src.parsers.figma_parser import FigmaParser
from src.parsers.photoshop_parser import PhotoshopParser
from src.parsers.browser_plugin_parser import BrowserPluginParser
from src.parsers.parser_factory import ParserFactory, get_parser_for_file, get_parser_for_application

__all__ = [
    "BaseParser",
    "ParseResult",
    "JSONParser",
    "CSVParser",
    "VSCodeParser",
    "FigmaParser",
    "PhotoshopParser",
    "BrowserPluginParser",
    "ParserFactory",
    "get_parser_for_file",
    "get_parser_for_application",
]
