from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from ..utils.helpers import generate_id, get_current_time, hash_data


class CandidateStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


@dataclass
class CandidateRecord:
    """召回候选表单条记录"""
    track_id: str
    predicted_value: float
    reported_threshold: float
    is_missing: bool
    source: str
    metadata: Dict = field(default_factory=dict)
    record_id: str = field(default_factory=lambda: generate_id("cand"))
    created_at: datetime = field(default_factory=get_current_time)
    status: CandidateStatus = CandidateStatus.PENDING
    import_hash: str = ""

    def __post_init__(self):
        if not self.import_hash:
            self.import_hash = hash_data({
                "track_id": self.track_id,
                "predicted_value": self.predicted_value,
                "reported_threshold": self.reported_threshold,
            })


@dataclass
class CandidateTable:
    """召回候选表"""
    table_id: str = field(default_factory=lambda: generate_id("ct"))
    name: str = ""
    records: List[CandidateRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=get_current_time)
    created_by: str = ""
    import_batch: str = ""
    version: int = 1
    is_active: bool = True

    def add_records(self, records: List[CandidateRecord]) -> List[str]:
        """添加记录，返回重复记录的ID列表"""
        existing_hashes = {r.import_hash for r in self.records}
        added_ids = []
        for record in records:
            if record.import_hash not in existing_hashes:
                self.records.append(record)
                added_ids.append(record.record_id)
                existing_hashes.add(record.import_hash)
        return added_ids

    def get_duplicates(self, records: List[CandidateRecord]) -> List[CandidateRecord]:
        """检测重复记录"""
        existing_hashes = {r.import_hash for r in self.records}
        return [r for r in records if r.import_hash in existing_hashes]

    def get_record_by_track_id(self, track_id: str) -> Optional[CandidateRecord]:
        for record in self.records:
            if record.track_id == track_id:
                return record
        return None
