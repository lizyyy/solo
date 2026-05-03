"""
船舶数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import List, Optional


@dataclass
class Ship:
    """船舶信息"""
    name: str
    imo: Optional[str] = None
    draft: float = 0.0  # 吃水深度（米）
    cargo_weight: float = 0.0  # 货重（吨）
    length: float = 0.0  # 船长（米）
    width: float = 0.0  # 船宽（米）
    required_berth_types: List[str] = field(default_factory=list)  # 需要的泊位类型
    required_tug_count: int = 0  # 需要的拖轮数量
    arrival_time: Optional[datetime] = None  # 预计到达时间
    departure_time: Optional[datetime] = None  # 预计离开时间
    operation_duration: timedelta = field(default_factory=lambda: timedelta(hours=4))  # 作业时长
    
    def __str__(self) -> str:
        return f"{self.name} (吃水: {self.draft:.2f}m)"
