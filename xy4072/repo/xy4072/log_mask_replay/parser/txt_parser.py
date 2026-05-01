"""文本格式日志解析器"""

from pathlib import Path
from typing import List

from .base import BaseParser, LogEntry


class TxtParser(BaseParser):
    """文本格式日志解析器"""
    
    def __init__(self):
        """初始化文本解析器"""
        super().__init__()
    
    def parse(self, file_path: Path) -> List[LogEntry]:
        """
        解析文本格式日志文件
        
        Args:
            file_path: 日志文件路径
            
        Returns:
            解析后的日志条目列表
        """
        entries = []
        source_file = file_path.name
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line_number, line in enumerate(f, start=1):
                    # 去除行尾的换行符和空白字符
                    stripped_line = line.rstrip()
                    
                    # 创建日志条目
                    entry = self.create_log_entry(
                        raw_content=stripped_line,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content={"content": stripped_line}
                    )
                    
                    entries.append(entry)
        except UnicodeDecodeError:
            # 尝试使用其他编码
            with open(file_path, "r", encoding="gbk") as f:
                for line_number, line in enumerate(f, start=1):
                    stripped_line = line.rstrip()
                    entry = self.create_log_entry(
                        raw_content=stripped_line,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content={"content": stripped_line}
                    )
                    entries.append(entry)
        
        return entries
    
    def supports_format(self, file_path: Path) -> bool:
        """
        检查是否支持该文件格式
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否支持该格式
        """
        ext = file_path.suffix.lower()
        return ext == ".txt" or ext == ""
