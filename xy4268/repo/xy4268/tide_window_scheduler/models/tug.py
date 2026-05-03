"""
拖轮数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import List, Optional

from .base import TimeSlot


@dataclass
class Tug:
    """拖轮信息"""
    id: str
    name: str
    capacity: float  # 拖力（吨）
    available_time_slots: List[TimeSlot] = field(default_factory=list)  # 可用时间段
    
    def is_available(self, start_time: time, end_time: time) -> bool:
        """检查拖轮在指定时间段是否可用"""
        check_slot = TimeSlot(start_time, end_time)
        return any(slot.overlaps(check_slot) for slot in self.available_time_slots)
    
    def __str__(self) -> str:
        return f"{self.name} (拖力: {self.capacity}吨)"
