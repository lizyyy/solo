"""数据模型 - 明确区分原始信息与处理结果

字段命名规则：
- original_*: 原始输入信息，不可修改，用于溯源
- processed_*: 系统处理结果，可修改，用于决策
- meta_*: 元数据，用于审计
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class DeviceStatus(str, Enum):
    """设备状态"""
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class GrayscaleState(str, Enum):
    """灰度状态机 - 设备级"""
    PENDING = "pending"
    PENDING_CONFIRM = "pending_confirm"
    ROLLING = "rolling"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLBACK = "rollback"
    ROLLED_BACK = "rolled_back"
    ROLLBACK_FAILED = "rollback_failed"


class BatchState(str, Enum):
    """批次状态机 - 批次级"""
    BATCH_PENDING = "batch_pending"
    BATCH_ROLLING = "batch_rolling"
    BATCH_PAUSED = "batch_paused"
    BATCH_SUCCESS = "batch_success"
    BATCH_FAILED = "batch_failed"
    BATCH_ROLLING_BACK = "batch_rolling_back"
    BATCH_ROLLED_BACK = "batch_rolled_back"


class ConfirmReason(str, Enum):
    """待确认原因"""
    OFFLINE_DEVICE = "offline_device"
    VERSION_DOWNGRADE = "version_downgrade"
    TOO_MANY_FAILURES = "too_many_failures"


@dataclass
class Device:
    """设备信息 - 原始信息为主，少量处理结果"""
    original_device_id: str
    original_firmware_version: str
    original_batch: str
    original_online_status: DeviceStatus
    original_failure_log: Optional[str] = None

    processed_target_version: Optional[str] = None
    processed_current_state: GrayscaleState = GrayscaleState.PENDING
    processed_confirm_reasons: List[ConfirmReason] = field(default_factory=list)
    processed_failure_count: int = 0
    processed_last_failure_time: Optional[datetime] = None
    processed_rollback_from_version: Optional[str] = None
    processed_rollback_log: Optional[str] = None
    processed_upgrade_log: Optional[str] = None

    meta_created_at: datetime = field(default_factory=datetime.now)
    meta_updated_at: datetime = field(default_factory=datetime.now)
    meta_id: str = field(default_factory=lambda: f"dev_{datetime.now().strftime('%Y%m%d%H%M%S%f')}")

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
            elif isinstance(v, Enum):
                data[k] = v.value
            elif isinstance(v, list) and v and isinstance(v[0], Enum):
                data[k] = [x.value for x in v]
        return data

    def needs_confirm(self) -> bool:
        return self.processed_current_state == GrayscaleState.PENDING_CONFIRM


@dataclass
class Batch:
    """批次信息"""
    original_batch_id: str
    original_batch_name: str
    original_device_ids: List[str]
    original_target_version: str

    processed_devices: List[Device] = field(default_factory=list)
    processed_state: BatchState = BatchState.BATCH_PENDING
    processed_success_count: int = 0
    processed_failed_count: int = 0
    processed_pending_count: int = 0
    processed_rollback_count: int = 0
    processed_pending_confirm_count: int = 0

    meta_created_at: datetime = field(default_factory=datetime.now)
    meta_updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
            elif isinstance(v, Enum):
                data[k] = v.value
            elif isinstance(v, list) and v and isinstance(v[0], Device):
                data[k] = [d.to_dict() for d in v]
        return data

    def get_statistics(self) -> Dict[str, int]:
        stats = {
            "total": len(self.processed_devices),
            "pending": 0,
            "pending_confirm": 0,
            "rolling": 0,
            "success": 0,
            "failed": 0,
            "rollback": 0,
            "rolled_back": 0,
            "rollback_failed": 0,
        }
        for dev in self.processed_devices:
            stats[dev.processed_current_state.value] += 1
        return stats


@dataclass
class GrayscaleTask:
    """灰度任务 - 顶层"""
    original_task_id: str
    original_task_name: str
    original_target_version: str
    original_description: Optional[str] = None

    processed_batches: List[Batch] = field(default_factory=list)
    processed_total_success: int = 0
    processed_total_failed: int = 0
    processed_total_pending: int = 0
    processed_total_rollback: int = 0
    processed_total_pending_confirm: int = 0

    meta_created_at: datetime = field(default_factory=datetime.now)
    meta_updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
            elif isinstance(v, list) and v and isinstance(v[0], Batch):
                data[k] = [b.to_dict() for b in v]
        return data

    def get_all_devices(self) -> List[Device]:
        devices = []
        for batch in self.processed_batches:
            devices.extend(batch.processed_devices)
        return devices


@dataclass
class RollbackRecord:
    """回滚记录"""
    original_device_id: str
    original_from_version: str
    original_to_version: str
    original_reason: str
    original_failure_log: Optional[str] = None

    processed_rollback_success: bool = False
    processed_rollback_log: Optional[str] = None

    meta_created_at: datetime = field(default_factory=datetime.now)
    meta_id: str = field(default_factory=lambda: f"rb_{datetime.now().strftime('%Y%m%d%H%M%S%f')}")

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
        return data


@dataclass
class AggregatedLog:
    """聚合日志"""
    device_id: str
    failure_count: int
    last_failure_time: Optional[datetime]
    failure_logs: List[str]
    rollback_logs: List[str]
    upgrade_logs: List[str]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
        return data
