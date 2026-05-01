"""核心数据模型和异常类型"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from .csv_parser import ScanAction, TicketRosterEntry, ScanLogEntry


class AnomalyType(str, Enum):
    """异常类型枚举"""
    UNKNOWN_TICKET = "unknown_ticket"
    BLACKLISTED = "blacklisted"
    WRONG_ENTRY = "wrong_entry"
    EXIT_BEFORE_ENTRY = "exit_before_entry"
    DUPLICATE_ENTRY = "duplicate_entry"
    SIMULTANEOUS_SCAN = "simultaneous_scan"
    BAD_ROW = "bad_row"
    INVALID_ACTION_ORDER = "invalid_action_order"
    REENTRY_NOT_ALLOWED = "reentry_not_allowed"


class TicketStatus(str, Enum):
    """票的状态"""
    UNUSED = "unused"
    IN_VENUE = "in_venue"
    EXITED = "exited"
    ANOMALY = "anomaly"
    QUARANTINED = "quarantined"


@dataclass
class AnomalyRecord:
    """异常记录"""
    anomaly_type: AnomalyType
    description: str
    timestamp: datetime
    ticket_number: str
    entry: Optional[str] = None
    device_id: Optional[str] = None
    operator: Optional[str] = None
    raw_log: Optional[Dict] = None
    severity: str = "warning"  # warning, error, critical


@dataclass
class TicketTimelineEntry:
    """票时间线条目"""
    timestamp: datetime
    action: ScanAction
    entry: str
    device_id: str
    operator: str
    corrected_timestamp: datetime  # 修正后的时间戳
    is_duplicate: bool = False
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    raw_log: Optional[Dict] = None


@dataclass
class TicketLedgerEntry:
    """台账条目"""
    ticket_number: str
    name: str
    phone_last_four: str
    ticket_type: str
    allowed_entries: List[str]
    is_blacklisted: bool
    
    current_status: TicketStatus = TicketStatus.UNUSED
    timeline: List[TicketTimelineEntry] = field(default_factory=list)
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    
    first_entry_time: Optional[datetime] = None
    last_exit_time: Optional[datetime] = None
    total_entries: int = 0
    total_exits: int = 0


@dataclass
class ReconciliationResult:
    """对账结果"""
    event_date: str
    reconciliation_time: datetime
    
    total_tickets: int = 0
    tickets_scanned: int = 0
    tickets_in_venue: int = 0
    tickets_exited: int = 0
    
    total_anomalies: int = 0
    anomaly_counts: Dict[AnomalyType, int] = field(default_factory=dict)
    
    entries_by_gate: Dict[str, int] = field(default_factory=dict)
    entries_by_ticket_type: Dict[str, int] = field(default_factory=dict)
    
    quarantined_count: int = 0
    duplicate_merges: int = 0  # 合并的重复扫码数量
    
    ledger: Dict[str, TicketLedgerEntry] = field(default_factory=dict)
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    
    # 统计信息
    stats: Dict[str, Any] = field(default_factory=dict)


class QuarantineItem(BaseModel):
    """隔离区条目"""
    id: str = Field(..., description="隔离条目唯一ID")
    quarantine_time: datetime = Field(..., description="隔离时间")
    anomaly_type: AnomalyType = Field(..., description="异常类型")
    description: str = Field(..., description="异常描述")
    
    # 原始数据
    raw_data: Optional[Dict] = Field(default=None, description="原始CSV行数据")
    source_file: Optional[str] = Field(default=None, description="源文件名")
    line_number: Optional[int] = Field(default=None, description="行号")
    
    # 相关信息
    ticket_number: Optional[str] = Field(default=None, description="票号（如果可识别）")
    device_id: Optional[str] = Field(default=None, description="设备号")
    entry: Optional[str] = Field(default=None, description="入口")
    timestamp_str: Optional[str] = Field(default=None, description="原始时间戳字符串")
    
    # 处理状态
    resolved: bool = Field(default=False, description="是否已处理")
    resolution: Optional[str] = Field(default=None, description="处理说明")
    resolved_at: Optional[datetime] = Field(default=None, description="处理时间")


class HistoryRecord(BaseModel):
    """历史记录"""
    event_date: str = Field(..., description="展会日期")
    reconciliation_time: datetime = Field(..., description="对账时间")
    
    summary: Dict[str, Any] = Field(default_factory=dict, description="对账摘要")
    
    # 引用文件
    ledger_path: Optional[str] = Field(default=None, description="台账文件路径")
    report_path: Optional[str] = Field(default=None, description="报告文件路径")
    anomalies_path: Optional[str] = Field(default=None, description="异常清单路径")
    
    # 统计
    total_scans: int = Field(default=0)
    total_anomalies: int = Field(default=0)
    quarantined_count: int = Field(default=0)
