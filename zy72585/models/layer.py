from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from .base import VersionedModel


class ResponsibleRole(str, Enum):
    DATA_SCIENTIST = "data_scientist"
    ALGORITHM_ENGINEER = "algorithm_engineer"
    BOTH = "both"


class LayerStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED_NORMAL = "confirmed_normal"
    CONFIRMED_ANOMALY = "confirmed_anomaly"
    NEEDS_DATA_SCIENTIST = "needs_data_scientist"
    NEEDS_ALGORITHM_ENGINEER = "needs_algorithm_engineer"
    SUSPENDED = "suspended"


@dataclass
class DecisionReason:
    why_kept: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_step_owner: ResponsibleRole = ResponsibleRole.ALGORITHM_ENGINEER
    next_action: str = ""
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "why_kept": self.why_kept,
            "missing_materials": self.missing_materials,
            "next_step_owner": self.next_step_owner.value,
            "next_action": self.next_action,
            "confidence": self.confidence,
        }


@dataclass
class LineageRef:
    candidate_table_id: str = ""
    candidate_record_id: str = ""
    params_yaml_id: str = ""
    params_version: int = 0
    threshold_name: str = ""
    threshold_value_at_time: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_table_id": self.candidate_table_id,
            "candidate_record_id": self.candidate_record_id,
            "params_yaml_id": self.params_yaml_id,
            "params_version": self.params_version,
            "threshold_name": self.threshold_name,
            "threshold_value_at_time": self.threshold_value_at_time,
        }


class LayerItem(VersionedModel):
    def __init__(self, record_id: str, layer_name: str, score: float):
        super().__init__()
        self.id = f"layer_item_{record_id}_{layer_name}"
        self.record_id: str = record_id
        self.layer_name: str = layer_name
        self.score: float = score
        self.status: LayerStatus = LayerStatus.PENDING_REVIEW
        self.reason: DecisionReason = DecisionReason()
        self.lineage: LineageRef = LineageRef()
        self.threshold_mismatch: bool = False
        self.reported_threshold: Optional[float] = None
        self.actual_threshold: Optional[float] = None

    def mark_threshold_mismatch(self, reported: float, actual: float, operator: str) -> None:
        self.update({
            "threshold_mismatch": True,
            "reported_threshold": reported,
            "actual_threshold": actual,
            "status": LayerStatus.SUSPENDED,
        }, operator, reason="检测到阈值不一致，悬置等待数据科学家复核")

    def set_decision(self, reason: DecisionReason, status: LayerStatus, operator: str) -> List:
        return self.update({
            "reason": reason,
            "status": status,
        }, operator, reason="更新分层决策")

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "reason": self.reason.to_dict(),
            "lineage": self.lineage.to_dict(),
            "status": self.status.value,
        })
        return base


class LayerResult(VersionedModel):
    def __init__(self, name: str):
        super().__init__()
        self.id = f"layer_result_{name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.name: str = name
        self.items: Dict[str, LayerItem] = {}
        self.candidate_table_id: str = ""
        self.params_yaml_id: str = ""
        self.generation_method: str = ""
        self.workflow_step: str = "initial"

    def add_item(self, item: LayerItem) -> None:
        self.items[item.record_id] = item
        self.updated_at = datetime.now()

    def get_item(self, record_id: str) -> Optional[LayerItem]:
        return self.items.get(record_id)

    def get_items_by_status(self, status: LayerStatus) -> List[LayerItem]:
        return [item for item in self.items.values() if item.status == status]

    def get_items_with_threshold_mismatch(self) -> List[LayerItem]:
        return [item for item in self.items.values() if item.threshold_mismatch]

    def get_item_count(self) -> int:
        return len(self.items)

    def get_summary(self) -> Dict[str, Any]:
        status_counts = {}
        for item in self.items.values():
            key = item.status.value
            status_counts[key] = status_counts.get(key, 0) + 1

        return {
            "name": self.name,
            "total_items": len(self.items),
            "status_counts": status_counts,
            "threshold_mismatch_count": len(self.get_items_with_threshold_mismatch()),
            "candidate_table_id": self.candidate_table_id,
            "params_yaml_id": self.params_yaml_id,
            "workflow_step": self.workflow_step,
        }
