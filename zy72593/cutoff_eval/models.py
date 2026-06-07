from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
import pandas as pd
from enum import Enum


class DataStatus(str, Enum):
    PENDING = "待复核"
    NORMAL = "正常"
    DUPLICATE = "重复训练"
    NEEDS_MORE_INFO = "材料不足"
    STRATEGY_REVIEW = "待策略产品复核"
    CONFIRMED = "已确认"


class NextOwner(str, Enum):
    STRATEGY_PM = "策略产品"
    EXPERIMENT_PLATFORM = "实验平台负责人阿越"
    DATA_TEAM = "数据团队"


@dataclass
class NegativeSample:
    sample_id: str
    batch_id: str
    item_id: str
    feature_version: str
    import_time: datetime
    source: str
    status: DataStatus = DataStatus.PENDING
    remarks: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NegativeSample":
        return cls(
            sample_id=str(data.get("sample_id", "")),
            batch_id=str(data.get("batch_id", "")),
            item_id=str(data.get("item_id", "")),
            feature_version=str(data.get("feature_version", "")),
            import_time=pd.to_datetime(data.get("import_time", datetime.now())),
            source=str(data.get("source", "")),
            status=DataStatus(data.get("status", DataStatus.PENDING)),
            remarks=str(data.get("remarks", "")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "batch_id": self.batch_id,
            "item_id": self.item_id,
            "feature_version": self.feature_version,
            "import_time": self.import_time.isoformat(),
            "source": self.source,
            "status": self.status.value,
            "remarks": self.remarks,
        }


@dataclass
class RecallCandidate:
    candidate_id: str
    batch_id: str
    item_id: str
    recall_score: float
    rank: int
    recall_strategy: str
    import_time: datetime
    status: DataStatus = DataStatus.PENDING
    linked_sample_id: Optional[str] = None
    remarks: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RecallCandidate":
        return cls(
            candidate_id=str(data.get("candidate_id", "")),
            batch_id=str(data.get("batch_id", "")),
            item_id=str(data.get("item_id", "")),
            recall_score=float(data.get("recall_score", 0.0)),
            rank=int(data.get("rank", 0)),
            recall_strategy=str(data.get("recall_strategy", "")),
            import_time=pd.to_datetime(data.get("import_time", datetime.now())),
            status=DataStatus(data.get("status", DataStatus.PENDING)),
            linked_sample_id=data.get("linked_sample_id"),
            remarks=str(data.get("remarks", "")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "batch_id": self.batch_id,
            "item_id": self.item_id,
            "recall_score": self.recall_score,
            "rank": self.rank,
            "recall_strategy": self.recall_strategy,
            "import_time": self.import_time.isoformat(),
            "status": self.status.value,
            "linked_sample_id": self.linked_sample_id,
            "remarks": self.remarks,
        }


@dataclass
class FeatureVersion:
    version_id: str
    feature_name: str
    batch_id: str
    item_id: str
    reason_kept: str
    missing_materials: List[str] = field(default_factory=list)
    next_owner: NextOwner = NextOwner.EXPERIMENT_PLATFORM
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: DataStatus = DataStatus.PENDING
    linked_sample_id: Optional[str] = None
    linked_candidate_id: Optional[str] = None
    remarks: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeatureVersion":
        return cls(
            version_id=str(data.get("version_id", "")),
            feature_name=str(data.get("feature_name", "")),
            batch_id=str(data.get("batch_id", "")),
            item_id=str(data.get("item_id", "")),
            reason_kept=str(data.get("reason_kept", "")),
            missing_materials=list(data.get("missing_materials", [])),
            next_owner=NextOwner(data.get("next_owner", NextOwner.EXPERIMENT_PLATFORM)),
            created_at=pd.to_datetime(data.get("created_at", datetime.now())),
            updated_at=pd.to_datetime(data.get("updated_at", datetime.now())),
            status=DataStatus(data.get("status", DataStatus.PENDING)),
            linked_sample_id=data.get("linked_sample_id"),
            linked_candidate_id=data.get("linked_candidate_id"),
            remarks=str(data.get("remarks", "")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "feature_name": self.feature_name,
            "batch_id": self.batch_id,
            "item_id": self.item_id,
            "reason_kept": self.reason_kept,
            "missing_materials": self.missing_materials,
            "next_owner": self.next_owner.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status.value,
            "linked_sample_id": self.linked_sample_id,
            "linked_candidate_id": self.linked_candidate_id,
            "remarks": self.remarks,
        }
