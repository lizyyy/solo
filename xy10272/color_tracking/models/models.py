from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
import uuid


class WorkflowStatus(Enum):
    PENDING = "待处理"
    SAMPLE_CREATED = "打样已创建"
    COLOR_MEASURED = "色差已测量"
    COMPARISON_DONE = "批次对比完成"
    NEEDS_REVIEW = "待复核"
    ADJUSTMENT_RECOMMENDED = "建议调整"
    ADJUSTMENT_APPLIED = "调整已应用"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    REPORT_GENERATED = "报告已生成"


class AlertLevel(Enum):
    NORMAL = "正常"
    WARNING = "警告"
    CRITICAL = "严重"


@dataclass
class ColorSample:
    sample_id: str
    lab_l: float
    lab_a: float
    lab_b: float
    measured_at: datetime = field(default_factory=datetime.now)
    measurement_conditions: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "lab_l": self.lab_l,
            "lab_a": self.lab_a,
            "lab_b": self.lab_b,
            "measured_at": self.measured_at.isoformat(),
            "measurement_conditions": self.measurement_conditions,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ColorSample":
        return cls(
            sample_id=data["sample_id"],
            lab_l=data["lab_l"],
            lab_a=data["lab_a"],
            lab_b=data["lab_b"],
            measured_at=datetime.fromisoformat(data["measured_at"]),
            measurement_conditions=data.get("measurement_conditions", {}),
        )


@dataclass
class BatchInfo:
    batch_id: str
    order_id: str
    product_name: str
    paper_type: str
    ink_type: str
    print_machine: str
    operator: str
    created_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "order_id": self.order_id,
            "product_name": self.product_name,
            "paper_type": self.paper_type,
            "ink_type": self.ink_type,
            "print_machine": self.print_machine,
            "operator": self.operator,
            "created_at": self.created_at.isoformat(),
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BatchInfo":
        return cls(
            batch_id=data["batch_id"],
            order_id=data["order_id"],
            product_name=data["product_name"],
            paper_type=data["paper_type"],
            ink_type=data["ink_type"],
            print_machine=data["print_machine"],
            operator=data["operator"],
            created_at=datetime.fromisoformat(data["created_at"]),
            notes=data.get("notes"),
        )


@dataclass
class PaperBatch:
    paper_id: str
    batch_code: str
    manufacturer: str
    weight: float
    whiteness: Optional[float] = None
    gloss: Optional[float] = None
    received_date: Optional[datetime] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "paper_id": self.paper_id,
            "batch_code": self.batch_code,
            "manufacturer": self.manufacturer,
            "weight": self.weight,
            "whiteness": self.whiteness,
            "gloss": self.gloss,
            "received_date": self.received_date.isoformat() if self.received_date else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaperBatch":
        return cls(
            paper_id=data["paper_id"],
            batch_code=data["batch_code"],
            manufacturer=data["manufacturer"],
            weight=data["weight"],
            whiteness=data.get("whiteness"),
            gloss=data.get("gloss"),
            received_date=datetime.fromisoformat(data["received_date"]) if data.get("received_date") else None,
            notes=data.get("notes"),
        )


@dataclass
class InkAdjustment:
    adjustment_id: str
    color_channel: str
    before_value: float
    after_value: float
    adjustment_reason: str
    adjusted_by: str
    adjusted_at: datetime = field(default_factory=datetime.now)
    expected_improvement: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adjustment_id": self.adjustment_id,
            "color_channel": self.color_channel,
            "before_value": self.before_value,
            "after_value": self.after_value,
            "adjustment_reason": self.adjustment_reason,
            "adjusted_by": self.adjusted_by,
            "adjusted_at": self.adjusted_at.isoformat(),
            "expected_improvement": self.expected_improvement,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InkAdjustment":
        return cls(
            adjustment_id=data["adjustment_id"],
            color_channel=data["color_channel"],
            before_value=data["before_value"],
            after_value=data["after_value"],
            adjustment_reason=data["adjustment_reason"],
            adjusted_by=data["adjusted_by"],
            adjusted_at=datetime.fromisoformat(data["adjusted_at"]),
            expected_improvement=data.get("expected_improvement"),
        )


@dataclass
class ColorDelta:
    delta_e76: float
    delta_e2000: float
    delta_l: float
    delta_a: float
    delta_b: float
    delta_c: Optional[float] = None
    delta_h: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "delta_e76": self.delta_e76,
            "delta_e2000": self.delta_e2000,
            "delta_l": self.delta_l,
            "delta_a": self.delta_a,
            "delta_b": self.delta_b,
            "delta_c": self.delta_c,
            "delta_h": self.delta_h,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ColorDelta":
        return cls(
            delta_e76=data["delta_e76"],
            delta_e2000=data["delta_e2000"],
            delta_l=data["delta_l"],
            delta_a=data["delta_a"],
            delta_b=data["delta_b"],
            delta_c=data.get("delta_c"),
            delta_h=data.get("delta_h"),
        )


@dataclass
class SampleRecord:
    record_id: str
    sequence_number: int
    batch_info: BatchInfo
    paper_batch: PaperBatch
    reference_sample: ColorSample
    measured_sample: ColorSample
    color_delta: Optional[ColorDelta] = None
    adjustments: List[InkAdjustment] = field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    alert_level: AlertLevel = AlertLevel.NORMAL
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None
    approved: Optional[bool] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "sequence_number": self.sequence_number,
            "batch_info": self.batch_info.to_dict(),
            "paper_batch": self.paper_batch.to_dict(),
            "reference_sample": self.reference_sample.to_dict(),
            "measured_sample": self.measured_sample.to_dict(),
            "color_delta": self.color_delta.to_dict() if self.color_delta else None,
            "adjustments": [adj.to_dict() for adj in self.adjustments],
            "status": self.status.value,
            "alert_level": self.alert_level.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "reviewer": self.reviewer,
            "review_notes": self.review_notes,
            "approved": self.approved,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SampleRecord":
        return cls(
            record_id=data["record_id"],
            sequence_number=data["sequence_number"],
            batch_info=BatchInfo.from_dict(data["batch_info"]),
            paper_batch=PaperBatch.from_dict(data["paper_batch"]),
            reference_sample=ColorSample.from_dict(data["reference_sample"]),
            measured_sample=ColorSample.from_dict(data["measured_sample"]),
            color_delta=ColorDelta.from_dict(data["color_delta"]) if data.get("color_delta") else None,
            adjustments=[InkAdjustment.from_dict(adj) for adj in data.get("adjustments", [])],
            status=WorkflowStatus(data["status"]),
            alert_level=AlertLevel(data["alert_level"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            reviewer=data.get("reviewer"),
            review_notes=data.get("review_notes"),
            approved=data.get("approved"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class SampleComparison:
    comparison_id: str
    order_id: str
    records: List[str]
    delta_trend: Dict[str, List[float]] = field(default_factory=dict)
    adjustments_summary: Dict[str, Any] = field(default_factory=dict)
    paper_batch_changes: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "comparison_id": self.comparison_id,
            "order_id": self.order_id,
            "records": self.records,
            "delta_trend": self.delta_trend,
            "adjustments_summary": self.adjustments_summary,
            "paper_batch_changes": self.paper_batch_changes,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SampleComparison":
        return cls(
            comparison_id=data["comparison_id"],
            order_id=data["order_id"],
            records=data["records"],
            delta_trend=data.get("delta_trend", {}),
            adjustments_summary=data.get("adjustments_summary", {}),
            paper_batch_changes=data.get("paper_batch_changes", []),
            created_at=datetime.fromisoformat(data["created_at"]),
        )


@dataclass
class TrackingReport:
    report_id: str
    order_id: str
    generated_at: datetime
    total_samples: int
    approved_samples: int
    rejected_samples: int
    pending_review: int
    max_delta_e2000: float
    min_delta_e2000: float
    avg_delta_e2000: float
    paper_batches_used: List[str]
    adjustments_applied: int
    alert_summary: Dict[str, int]
    recommendations: List[str]
    records: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "order_id": self.order_id,
            "generated_at": self.generated_at.isoformat(),
            "total_samples": self.total_samples,
            "approved_samples": self.approved_samples,
            "rejected_samples": self.rejected_samples,
            "pending_review": self.pending_review,
            "max_delta_e2000": self.max_delta_e2000,
            "min_delta_e2000": self.min_delta_e2000,
            "avg_delta_e2000": self.avg_delta_e2000,
            "paper_batches_used": self.paper_batches_used,
            "adjustments_applied": self.adjustments_applied,
            "alert_summary": self.alert_summary,
            "recommendations": self.recommendations,
            "records": self.records,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrackingReport":
        return cls(
            report_id=data["report_id"],
            order_id=data["order_id"],
            generated_at=datetime.fromisoformat(data["generated_at"]),
            total_samples=data["total_samples"],
            approved_samples=data["approved_samples"],
            rejected_samples=data["rejected_samples"],
            pending_review=data["pending_review"],
            max_delta_e2000=data["max_delta_e2000"],
            min_delta_e2000=data["min_delta_e2000"],
            avg_delta_e2000=data["avg_delta_e2000"],
            paper_batches_used=data["paper_batches_used"],
            adjustments_applied=data["adjustments_applied"],
            alert_summary=data["alert_summary"],
            recommendations=data["recommendations"],
            records=data["records"],
            metadata=data.get("metadata", {}),
        )


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"
