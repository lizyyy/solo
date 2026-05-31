from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import json


class ReviewStatus(str, Enum):
    NORMAL = "normal"
    PENDING_CONFIRM = "pending_confirm"
    REJECTED = "rejected"


class AnomalyType(str, Enum):
    DISCONNECT_PROGRESS_CORRUPT = "disconnect_progress_corrupt"
    RESTART_BRUSH_SCORE = "restart_brush_score"
    REWARD_MISSED = "reward_missed"
    NONE = "none"


class SourceType(str, Enum):
    DROP_CONFIG = "drop_config"
    SCREENSHOT = "screenshot"
    MANUAL = "manual"


@dataclass
class DropConfig:
    id: Optional[int] = None
    stage: str = ""
    item_name: str = ""
    drop_rate: float = 0.0
    source_file: str = ""
    version: int = 1
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "stage": self.stage,
            "item_name": self.item_name,
            "drop_rate": self.drop_rate,
            "source_file": self.source_file,
            "version": self.version,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "note": self.note,
        }


@dataclass
class LeaderboardRecord:
    id: Optional[int] = None
    player_id: str = ""
    player_name: str = ""
    score: int = 0
    rank: int = 0
    stage_progress: int = 0
    source_type: SourceType = SourceType.SCREENSHOT
    source_file: str = ""
    source_ref: str = ""
    review_status: ReviewStatus = ReviewStatus.NORMAL
    anomaly_type: AnomalyType = AnomalyType.NONE
    anomaly_note: str = ""
    version: int = 1
    import_batch_id: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "player_id": self.player_id,
            "player_name": self.player_name,
            "score": self.score,
            "rank": self.rank,
            "stage_progress": self.stage_progress,
            "source_type": self.source_type.value,
            "source_file": self.source_file,
            "source_ref": self.source_ref,
            "review_status": self.review_status.value,
            "anomaly_type": self.anomaly_type.value,
            "anomaly_note": self.anomaly_note,
            "version": self.version,
            "import_batch_id": self.import_batch_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class VersionHistory:
    id: Optional[int] = None
    batch_id: str = ""
    record_type: str = ""
    record_id: int = 0
    old_version: int = 0
    new_version: int = 0
    change_summary: str = ""
    changed_fields: List[str] = field(default_factory=list)
    old_values: Dict[str, Any] = field(default_factory=dict)
    new_values: Dict[str, Any] = field(default_factory=dict)
    operator: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "record_type": self.record_type,
            "record_id": self.record_id,
            "old_version": self.old_version,
            "new_version": self.new_version,
            "change_summary": self.change_summary,
            "changed_fields": self.changed_fields,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "operator": self.operator,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class ImportBatch:
    id: Optional[int] = None
    batch_id: str = ""
    source_file: str = ""
    record_type: str = ""
    record_count: int = 0
    is_revoked: bool = False
    revoke_reason: str = ""
    operator: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    revoked_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "source_file": self.source_file,
            "record_type": self.record_type,
            "record_count": self.record_count,
            "is_revoked": self.is_revoked,
            "revoke_reason": self.revoke_reason,
            "operator": self.operator,
            "created_at": self.created_at.isoformat(),
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
        }


class TraceableResult:
    def __init__(self, record: LeaderboardRecord, drop_configs: List[DropConfig] = None):
        self.record = record
        self.drop_configs = drop_configs or []
        self.evidence_paths: List[str] = []
        self.version_history: List[VersionHistory] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record": self.record.to_dict(),
            "drop_configs": [dc.to_dict() for dc in self.drop_configs],
            "evidence_paths": self.evidence_paths,
            "version_history": [vh.to_dict() for vh in self.version_history],
        }
