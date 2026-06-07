from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DropoutStatus(str, Enum):
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    TIME_WINDOW_CROSSED = "time_window_crossed"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    CONFIRMED_DROPOUT = "confirmed_dropout"
    REVIEWED_NORMAL = "reviewed_normal"
    ROLLED_BACK = "rolled_back"


class FeatureSnapshot(BaseModel):
    snapshot_id: str
    client_id: str
    round_num: int
    timestamp: datetime
    feature_hash: str
    feature_count: int
    imported_by: str
    import_time: datetime = Field(default_factory=datetime.now)

    @field_validator('snapshot_id')
    def snapshot_id_not_empty(cls, v):
        if not v.strip():
            raise ValueError('snapshot_id cannot be empty')
        return v


class TrainingLog(BaseModel):
    log_id: str
    client_id: str
    round_num: int
    timestamp: datetime
    loss: float
    accuracy: float
    epoch: int
    samples_processed: int
    log_content: str = ""


class DropoutRecord(BaseModel):
    record_id: str
    client_id: str
    round_num: int
    detected_at: datetime = Field(default_factory=datetime.now)
    status: DropoutStatus = DropoutStatus.PENDING_REVIEW
    snapshot_ids: List[str] = Field(default_factory=list)
    log_ids: List[str] = Field(default_factory=list)
    remarks: str = ""
    detected_by: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: str = ""
    anomaly_score: float = 0.0
    time_window_crossed: bool = False
    time_window_details: Dict[str, Any] = Field(default_factory=dict)


class HistoryEntry(BaseModel):
    entry_id: str
    record_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: datetime = Field(default_factory=datetime.now)
    change_type: str = "update"


class ReviewDecision(BaseModel):
    record_id: str
    decision: str
    reviewer: str
    notes: str = ""
    decided_at: datetime = Field(default_factory=datetime.now)
