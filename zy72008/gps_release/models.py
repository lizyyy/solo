from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime


class Status(str, Enum):
    PENDING = "pending"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    REJECTED = "rejected"


class Source(str, Enum):
    INITIAL = "initial"
    SUPPLEMENTARY = "supplementary"


class ImportMode(str, Enum):
    SKIP = "skip"
    UPDATE = "update"
    CONFLICT = "conflict"


STATUS_LABELS = {
    Status.PENDING: "待处理",
    Status.NEEDS_REVIEW: "需人工确认",
    Status.CONFIRMED: "已确认",
    Status.COMPLETED: "已完成",
    Status.REJECTED: "已驳回",
}

SOURCE_LABELS = {
    Source.INITIAL: "初始导入",
    Source.SUPPLEMENTARY: "补材料",
}

REQUIRED_FIELDS = ["contract_no", "customer_name"]
FINANCIAL_FIELDS = ["gps_fee", "payment_ref", "payment_date", "payment_amount"]
OPTIONAL_FIELDS = [
    "plate_no", "vehicle_model", "refund_applied", "refund_amount",
    "approval_email", "remarks", "receipt_info", "is_old_format",
]
ALL_FIELDS = REQUIRED_FIELDS + FINANCIAL_FIELDS + OPTIONAL_FIELDS


@dataclass
class GpsReleaseRecord:
    id: Optional[int] = None
    contract_no: str = ""
    customer_name: str = ""
    plate_no: Optional[str] = None
    vehicle_model: Optional[str] = None
    gps_fee: Optional[float] = None
    payment_ref: Optional[str] = None
    payment_date: Optional[str] = None
    payment_amount: Optional[float] = None
    refund_applied: Optional[int] = None
    refund_amount: Optional[float] = None
    approval_email: Optional[str] = None
    remarks: Optional[str] = None
    receipt_info: Optional[str] = None
    status: str = Status.PENDING.value
    source: str = Source.INITIAL.value
    is_old_format: int = 0
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None
    batch_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        d = asdict(self)
        d["status_label"] = STATUS_LABELS.get(Status(self.status), self.status)
        d["source_label"] = SOURCE_LABELS.get(Source(self.source), self.source)
        return d

    def missing_fields(self):
        missing = []
        for f in REQUIRED_FIELDS + FINANCIAL_FIELDS:
            if getattr(self, f) is None or getattr(self, f) == "":
                missing.append(f)
        return missing

    def needs_review_reasons(self):
        reasons = []
        if self.missing_fields():
            reasons.append(f"缺少必要字段: {', '.join(self.missing_fields())}")
        if self.gps_fee is not None and self.payment_amount is not None:
            if abs(self.gps_fee - self.payment_amount) > 0.01:
                reasons.append(
                    f"GPS费用({self.gps_fee})与收款金额({self.payment_amount})不一致"
                )
        if self.is_old_format:
            reasons.append("旧口径数据，需核实")
        if self.receipt_info and "截图" in self.receipt_info:
            reasons.append("来源于银企回单截图，需人工核实")
        return reasons


@dataclass
class ImportLog:
    id: Optional[int] = None
    batch_id: str = ""
    file_name: str = ""
    import_time: str = field(default_factory=lambda: datetime.now().isoformat())
    total_records: int = 0
    inserted: int = 0
    skipped: int = 0
    updated: int = 0
    conflicted: int = 0
    details: str = "[]"

    def to_dict(self):
        return asdict(self)
