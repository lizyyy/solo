from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class TicketType(str, Enum):
    FREE = "赠票"
    PAID = "售票"
    UNKNOWN = "待确认"


class BatchStatus(str, Enum):
    NORMAL = "正常"
    MIXED = "赠票售票混批"
    PENDING_REVIEW = "待录音师复核"
    REVIEWED = "已复核"


class AlertLevel(str, Enum):
    INFO = "信息"
    WARNING = "警告"
    BLOCKER = "阻断"


class ActionType(str, Enum):
    IMPORT = "导入"
    MANUAL_EDIT = "人工修正"
    RERUN = "重跑"
    AUTH_UPDATE = "授权更新"
    REVIEW = "复核"


@dataclass
class TicketRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    batch_no: str = ""
    ticket_no: str = ""
    ticket_type: TicketType = TicketType.UNKNOWN
    artist_name: str = ""
    amount: float = 0.0
    audio_remark: str = ""
    original_remark: str = ""
    auth_period: Optional[str] = None
    source_file: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: Optional[str] = None


@dataclass
class BatchSummary:
    batch_no: str = ""
    total_tickets: int = 0
    free_count: int = 0
    paid_count: int = 0
    unknown_count: int = 0
    total_amount: float = 0.0
    status: BatchStatus = BatchStatus.NORMAL
    needs_review: bool = False
    reviewer: Optional[str] = None
    reviewed_at: Optional[str] = None


@dataclass
class AuthAlert:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    batch_no: str = ""
    level: AlertLevel = AlertLevel.WARNING
    title: str = ""
    reason: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_step: str = ""
    assignee: str = ""
    resolved: bool = False
    resolved_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    trigger_ticket_nos: List[str] = field(default_factory=list)
    trigger_remarks: List[str] = field(default_factory=list)


@dataclass
class AuditLog:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    action: ActionType = ActionType.IMPORT
    operator: str = ""
    target_batch: Optional[str] = None
    target_ticket: Optional[str] = None
    target_ticket_no: Optional[str] = None
    before_text: str = ""
    after_text: str = ""
    changes: Dict[str, Any] = field(default_factory=dict)
    reason: str = ""
    affected_results: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class SettlementRun:
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    run_no: int = 1
    operator: str = ""
    source_files: List[str] = field(default_factory=list)
    tickets: List[TicketRecord] = field(default_factory=list)
    batches: Dict[str, BatchSummary] = field(default_factory=dict)
    alerts: List[AuthAlert] = field(default_factory=list)
    is_rerun: bool = False
    parent_run_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
