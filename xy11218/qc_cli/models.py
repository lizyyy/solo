from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class RecordType(Enum):
    SAMPLE = "留样"
    TEMPERATURE = "冰箱温度"
    DISCARD = "废弃"


class Status(Enum):
    PENDING = "待复核"
    APPROVED = "已通过"
    REJECTED = "已驳回"


class AbnormalType(Enum):
    NONE = "无异常"
    TEMPERATURE_HIGH = "温度过高"
    TEMPERATURE_LOW = "温度过低"
    EXPIRED = "超时未处理"
    MISSING = "记录缺失"
    FORMAT_ERROR = "格式错误"


@dataclass
class QualityRecord:
    id: str
    record_type: RecordType
    date: str
    store_name: str
    responsible: str
    item_name: str
    temperature: Optional[float] = None
    sample_time: Optional[str] = None
    discard_time: Optional[str] = None
    status: Status = Status.PENDING
    abnormal_type: AbnormalType = AbnormalType.NONE
    remark: str = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "record_type": self.record_type.value,
            "date": self.date,
            "store_name": self.store_name,
            "responsible": self.responsible,
            "item_name": self.item_name,
            "temperature": self.temperature,
            "sample_time": self.sample_time,
            "discard_time": self.discard_time,
            "status": self.status.value,
            "abnormal_type": self.abnormal_type.value,
            "remark": self.remark,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "QualityRecord":
        return cls(
            id=data["id"],
            record_type=RecordType(data["record_type"]),
            date=data["date"],
            store_name=data["store_name"],
            responsible=data["responsible"],
            item_name=data["item_name"],
            temperature=data.get("temperature"),
            sample_time=data.get("sample_time"),
            discard_time=data.get("discard_time"),
            status=Status(data["status"]),
            abnormal_type=AbnormalType(data["abnormal_type"]),
            remark=data.get("remark", ""),
            reviewed_by=data.get("reviewed_by"),
            reviewed_at=data.get("reviewed_at"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
        )


@dataclass
class BatchResult:
    success_ids: List[str]
    failed_ids: List[str]
    errors: List[str]

    def has_errors(self) -> bool:
        return len(self.failed_ids) > 0

    def summary(self) -> str:
        total = len(self.success_ids) + len(self.failed_ids)
        return f"批量操作完成: 成功 {len(self.success_ids)}/{total}, 失败 {len(self.failed_ids)}/{total}"
