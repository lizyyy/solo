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
class ImportBatchInfo:
    """单次导入批次信息"""
    batch_id: str = field(default_factory=lambda: generate_id("batch"))
    import_time: datetime = field(default_factory=get_current_time)
    imported_by: str = ""
    total_count: int = 0
    new_count: int = 0
    duplicate_count: int = 0
    duplicate_track_ids: List[str] = field(default_factory=list)
    new_track_ids: List[str] = field(default_factory=list)


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
    import_history: List[ImportBatchInfo] = field(default_factory=list)

    def check_duplicates(self, records: List[CandidateRecord]) -> List[CandidateRecord]:
        """
        检测重复记录（在添加之前调用）
        返回与表中已有记录重复的记录列表
        """
        existing_hashes = {r.import_hash for r in self.records}
        return [r for r in records if r.import_hash in existing_hashes]

    def check_intra_batch_duplicates(self, records: List[CandidateRecord]) -> List[CandidateRecord]:
        """
        检测同一批导入记录内部的重复
        """
        seen_hashes = set()
        duplicates = []
        for record in records:
            if record.import_hash in seen_hashes:
                duplicates.append(record)
            else:
                seen_hashes.add(record.import_hash)
        return duplicates

    def add_records(self, records: List[CandidateRecord], imported_by: str = "") -> ImportBatchInfo:
        """
        添加记录（先检测再添加）
        返回导入批次信息（含新增和重复明细）
        """
        table_dupes = self.check_duplicates(records)
        intra_dupes = self.check_intra_batch_duplicates(records)

        all_dupe_hashes = {r.import_hash for r in table_dupes} | {r.import_hash for r in intra_dupes}

        new_records = []
        new_track_ids = []
        duplicate_track_ids = [r.track_id for r in table_dupes]

        existing_hashes = {r.import_hash for r in self.records}
        for record in records:
            if record.import_hash not in existing_hashes:
                self.records.append(record)
                new_records.append(record)
                new_track_ids.append(record.track_id)
                existing_hashes.add(record.import_hash)

        batch_info = ImportBatchInfo(
            imported_by=imported_by,
            total_count=len(records),
            new_count=len(new_records),
            duplicate_count=len(table_dupes) + len(intra_dupes),
            duplicate_track_ids=duplicate_track_ids,
            new_track_ids=new_track_ids,
        )

        self.import_history.append(batch_info)
        self.version += 1

        return batch_info

    def get_duplicates(self, records: List[CandidateRecord]) -> List[CandidateRecord]:
        """检测重复记录（兼容旧接口）"""
        return self.check_duplicates(records)

    def get_record_by_track_id(self, track_id: str) -> Optional[CandidateRecord]:
        for record in self.records:
            if record.track_id == track_id:
                return record
        return None

    def get_latest_import_batch(self) -> Optional[ImportBatchInfo]:
        """获取最近一次导入批次信息"""
        if self.import_history:
            return self.import_history[-1]
        return None

    def get_all_track_ids(self) -> List[str]:
        """获取所有轨迹ID"""
        return [r.track_id for r in self.records]
