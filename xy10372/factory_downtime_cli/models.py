"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class RecordStatus(Enum):
    VALID = "有效"
    DUPLICATE = "重复"
    INVALID_TIME = "时间无效"
    OVERLAP = "时间重叠"
    NO_PLAN = "无对应计划"
    PENDING_REVIEW = "待复核"


@dataclass
class ProductionPlan:
    """机台生产计划"""
    plan_id: str
    machine_id: str
    product_code: str
    planned_start: datetime
    planned_end: datetime
    planned_quantity: int
    status: str = "active"
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ChangeoverRecord:
    """换模开始结束记录"""
    record_id: str
    machine_id: str
    from_product: str
    to_product: str
    start_time: datetime
    end_time: datetime
    operator: Optional[str] = None
    status: RecordStatus = RecordStatus.VALID
    source_hash: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def duration_minutes(self) -> float:
        if self.end_time and self.start_time:
            return (self.end_time - self.start_time).total_seconds() / 60
        return 0.0


@dataclass
class AbnormalDowntime:
    """异常停机记录"""
    record_id: str
    machine_id: str
    downtime_type: str
    start_time: datetime
    end_time: datetime
    reason: str = ""
    operator: Optional[str] = None
    status: RecordStatus = RecordStatus.VALID
    source_hash: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def duration_minutes(self) -> float:
        if self.end_time and self.start_time:
            return (self.end_time - self.start_time).total_seconds() / 60
        return 0.0


@dataclass
class ProductionRecord:
    """产量记录"""
    record_id: str
    machine_id: str
    product_code: str
    quantity: int
    production_time: datetime
    plan_id: Optional[str] = None
    status: RecordStatus = RecordStatus.VALID
    source_hash: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class MachineDailyReport:
    """机台日报"""
    machine_id: str
    date: datetime
    total_minutes: float = 0.0
    planned_downtime_minutes: float = 0.0
    abnormal_downtime_minutes: float = 0.0
    effective_production_minutes: float = 0.0
    actual_output: int = 0
    efficiency: float = 0.0
    planned_downtime_sources: List[str] = field(default_factory=list)
    abnormal_downtime_sources: List[str] = field(default_factory=list)
    exceptions: List[str] = field(default_factory=list)


@dataclass
class DataStore:
    """数据存储"""
    plans: Dict[str, ProductionPlan] = field(default_factory=dict)
    changeovers: Dict[str, ChangeoverRecord] = field(default_factory=dict)
    abnormal_downtimes: Dict[str, AbnormalDowntime] = field(default_factory=dict)
    productions: Dict[str, ProductionRecord] = field(default_factory=dict)
    changeover_hashes: Dict[str, str] = field(default_factory=dict)
    downtime_hashes: Dict[str, str] = field(default_factory=dict)
    production_hashes: Dict[str, str] = field(default_factory=dict)
