"""基础导入器类"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, List


class BaseImporter(ABC):
    """导入器基类"""
    
    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)
        self._data: List[Any] = []
    
    @abstractmethod
    def parse(self) -> List[Any]:
        """解析文件内容"""
        pass
    
    @property
    def data(self) -> List[Any]:
        """获取解析后的数据"""
        if not self._data:
            self._data = self.parse()
        return self._data


def parse_timecode(timecode: str) -> float:
    """
    将 SRT 时间码转换为秒数
    格式: 00:00:00,000 或 00:00:00.000
    """
    timecode = timecode.strip().replace(",", ".")
    parts = timecode.split(":")
    
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    elif len(parts) == 2:
        minutes = int(parts[0])
        seconds = float(parts[1])
        return minutes * 60 + seconds
    else:
        return float(timecode)


def format_timecode(seconds: float) -> str:
    """将秒数转换为 SRT 时间码格式"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", ",")
