"""SRT 字幕导入器"""

import re
from pathlib import Path
from typing import Any, Dict, List

from .base import BaseImporter, parse_timecode


class SRTImporter(BaseImporter):
    """SRT 字幕导入器"""
    
    PATTERN = re.compile(
        r"(\d+)\s*\n"
        r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*\n"
        r"((?:.|\n)*?)(?:\n\n|\n*$)",
        re.MULTILINE
    )
    
    def __init__(self, file_path: str | Path):
        super().__init__(file_path)
    
    def parse(self) -> List[Dict[str, Any]]:
        """解析 SRT 字幕文件"""
        subtitles = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        matches = self.PATTERN.findall(content)
        
        for match in matches:
            index = int(match[0])
            start_timecode = match[1]
            end_timecode = match[2]
            text = match[3].strip()
            
            subtitle = {
                "index": index,
                "start_time": parse_timecode(start_timecode),
                "end_time": parse_timecode(end_timecode),
                "text": text,
            }
            subtitles.append(subtitle)
        
        return subtitles
