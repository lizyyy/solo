"""
泊位数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import List, Optional

from .base import TimeSlot


@dataclass
class Berth:
    """泊位信息"""
    id: str
    name: str
    type: str  # 泊位类型，如 'general', 'container', 'liquid' 等
    max_draft: float  # 最大允许吃水（米）
    max_length: float  # 最大允许船长（米）
    max_width: float  # 最大允许船宽（米）
    available_time_slots: List[TimeSlot] = field(default_factory=list)  # 可用时间段
    restrictions: List[str] = field(default_factory=list)  # 限制条件
    
    def is_available(self, start_time: time, end_time: time) -> bool:
        """检查泊位在指定时间段是否可用"""
        check_slot = TimeSlot(start_time, end_time)
        return any(slot.overlaps(check_slot) for slot in self.available_time_slots)
    
    def __str__(self) -> str:
        return f"{self.name} (最大吃水: {self.max_draft:.2f}m)"
