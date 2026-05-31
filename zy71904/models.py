from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class RecordStatus(Enum):
    PENDING = "待处理"
    PROCESSED = "已处理"
    DUPLICATE = "重复记录"
    CONFLICT = "数据冲突"
    ARCHIVED = "已归档"


class DuplicateReason(Enum):
    SAME_BATCH = "同一批次重复导入"
    SAME_DATE_STUDENT = "同学生同日多练"
    MANUAL_MARK = "人工标记重复"
    CONTENT_HASH_MATCH = "内容指纹匹配"


@dataclass
class Student:
    student_id: str
    name: str
    section: str
    voice_part: str

    def unique_key(self) -> str:
        return f"{self.student_id}_{self.name}"


@dataclass
class DrumRecord:
    record_id: str
    student: Student
    practice_date: str
    practice_content: str
    rhythm_accuracy: float
    tempo_stability: float
    overall_score: float
    teacher_notes: str = ""
    accompanist_notes: str = ""
    batch_id: str = ""
    source_file: str = ""
    content_hash: str = ""
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class ProcessedRecord:
    record: DrumRecord
    status: RecordStatus
    duplicate_of: Optional[str] = None
    duplicate_reason: Optional[DuplicateReason] = None
    review_notes: List[str] = field(default_factory=list)
    processed_at: datetime = field(default_factory=datetime.now)
    processed_by: str = "system"

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record.record_id,
            "student_id": self.record.student.student_id,
            "student_name": self.record.student.name,
            "section": self.record.student.section,
            "voice_part": self.record.student.voice_part,
            "practice_date": self.record.practice_date,
            "practice_content": self.record.practice_content,
            "rhythm_accuracy": self.record.rhythm_accuracy,
            "tempo_stability": self.record.tempo_stability,
            "overall_score": self.record.overall_score,
            "teacher_notes": self.record.teacher_notes,
            "accompanist_notes": self.record.accompanist_notes,
            "batch_id": self.record.batch_id,
            "source_file": self.record.source_file,
            "content_hash": self.record.content_hash,
            "imported_at": self.record.imported_at.isoformat(),
            "status": self.status.value,
            "duplicate_of": self.duplicate_of,
            "duplicate_reason": self.duplicate_reason.value if self.duplicate_reason else None,
            "review_notes": self.review_notes,
            "processed_at": self.processed_at.isoformat(),
            "processed_by": self.processed_by
        }


@dataclass
class ProcessingResult:
    batch_id: str
    total_records: int
    new_records: int
    duplicate_records: int
    conflict_records: int
    processed_records: List[ProcessedRecord]
    generated_at: datetime = field(default_factory=datetime.now)
