"""数据模型定义。"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class IssueType(Enum):
    MISSING_SCAN = "漏扫"
    DUPLICATE_BARCODE = "重复条码"
    ROOM_MIXUP = "考场混放"
    ABSENT_WITH_SHEET = "缺考却有答题卡"
    PAGE_ORIENTATION = "页码方向异常"
    EXTRA_SHEET = "额外答题卡"


class IssueSeverity(Enum):
    CRITICAL = "严重"
    MAJOR = "重要"
    MINOR = "轻微"


@dataclass
class Student:
    student_id: str
    name: str
    room_number: str
    seat_number: int
    department: Optional[str] = None
    class_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "room_number": self.room_number,
            "seat_number": self.seat_number,
            "department": self.department,
            "class_name": self.class_name,
        }


@dataclass
class AnswerSheet:
    barcode: str
    filename: str
    file_path: str
    page_number: Optional[int] = None
    total_pages: Optional[int] = None
    orientation: Optional[str] = None
    scanned_at: Optional[datetime] = None
    extracted_text: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "barcode": self.barcode,
            "filename": self.filename,
            "file_path": self.file_path,
            "page_number": self.page_number,
            "total_pages": self.total_pages,
            "orientation": self.orientation,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
            "extracted_text": self.extracted_text,
        }


@dataclass
class AbsentRecord:
    student_id: str
    room_number: str
    seat_number: int
    reason: Optional[str] = None
    recorded_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "student_id": self.student_id,
            "room_number": self.room_number,
            "seat_number": self.seat_number,
            "reason": self.reason,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


@dataclass
class GradingBatch:
    batch_id: str
    exam_name: str
    exam_date: str
    course_code: str
    course_name: str
    total_students: int
    rooms: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "exam_name": self.exam_name,
            "exam_date": self.exam_date,
            "course_code": self.course_code,
            "course_name": self.course_name,
            "total_students": self.total_students,
            "rooms": self.rooms,
        }


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    description: str
    affected_barcodes: List[str]
    affected_files: List[str]
    room_number: Optional[str] = None
    recommendation: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "description": self.description,
            "affected_barcodes": self.affected_barcodes,
            "affected_files": self.affected_files,
            "room_number": self.room_number,
            "recommendation": self.recommendation,
            "notes": self.notes,
        }


@dataclass
class RoomStatistics:
    room_number: str
    total_students: int
    present_students: int
    absent_students: int
    scanned_sheets: int
    missing_sheets: int
    duplicate_count: int
    issues: List[Issue] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_number": self.room_number,
            "total_students": self.total_students,
            "present_students": self.present_students,
            "absent_students": self.absent_students,
            "scanned_sheets": self.scanned_sheets,
            "missing_sheets": self.missing_sheets,
            "duplicate_count": self.duplicate_count,
            "issues_count": len(self.issues),
        }


@dataclass
class CheckResult:
    batch_id: str
    generated_at: datetime
    statistics: Dict[str, RoomStatistics]
    all_issues: List[Issue]
    scanned_sheets: Dict[str, AnswerSheet]
    student_roster: Dict[str, Student]
    absent_records: Dict[str, AbsentRecord]
    grading_batch: GradingBatch
    remark_store: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "generated_at": self.generated_at.isoformat(),
            "statistics": {k: v.to_dict() for k, v in self.statistics.items()},
            "all_issues": [i.to_dict() for i in self.all_issues],
            "scanned_sheets_count": len(self.scanned_sheets),
            "student_roster_count": len(self.student_roster),
            "absent_records_count": len(self.absent_records),
            "grading_batch": self.grading_batch.to_dict(),
            "remark_store": self.remark_store,
        }
