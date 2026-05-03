"""
基础数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import List, Optional


@dataclass
class TimeSlot:
    """时间段"""
    start: time
    end: time
    
    def overlaps(self, other: 'TimeSlot') -> bool:
        """检查两个时间段是否重叠"""
        return self.start < other.end and other.start < self.end
    
    def __str__(self) -> str:
        return f"{self.start.strftime('%H:%M')} - {self.end.strftime('%H:%M')}"


@dataclass
class TidalRecord:
    """潮汐记录"""
    time: datetime
    height: float
    
    def __str__(self) -> str:
        return f"{self.time.strftime('%Y-%m-%d %H:%M')}: {self.height:.2f}m"
