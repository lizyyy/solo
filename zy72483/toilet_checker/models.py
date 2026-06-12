from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from enum import Enum


class PointType(str, Enum):
    NORMAL = "normal"
    NIGHT_SAMPLING = "night_sampling"


class ReviewStatus(str, Enum):
    PENDING = "待复核"
    BOUNDARY_PENDING = "边界待项目经理确认"
    COMPLAINT_ADDED = "已补录投诉"
    MANUAL_FIXED = "人工修正"
    RE_RUN = "重跑完成"
    CONFIRMED = "已确认"


@dataclass
class Street:
    id: str
    name: str
    boundary: List[Tuple[float, float]]
    color: str = "#3498db"


@dataclass
class Complaint:
    id: str
    complaint_no: str
    point_id: str
    description: str
    reporter: str
    report_date: str
    source: str = "12345热线"


@dataclass
class FieldChange:
    field_name: str
    field_label: str
    old_value: Any = None
    new_value: Any = None

    def to_dict(self) -> Dict:
        return {
            "field_name": self.field_name,
            "field_label": self.field_label,
            "old_value": str(self.old_value) if self.old_value is not None else None,
            "new_value": str(self.new_value) if self.new_value is not None else None
        }

    @classmethod
    def from_dict(cls, d: Dict) -> 'FieldChange':
        return cls(
            field_name=d["field_name"],
            field_label=d["field_label"],
            old_value=d.get("old_value"),
            new_value=d.get("new_value")
        )


@dataclass
class ReviewRecord:
    id: str
    point_id: str
    action: str
    operator: str
    timestamp: str
    note: str = ""
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    field_changes: List[FieldChange] = field(default_factory=list)
    affected_result: str = ""


@dataclass
class Point:
    id: str
    name: str
    lng: float
    lat: float
    address: str
    point_type: PointType = PointType.NORMAL
    is_night_sampling: bool = False
    street_ids: List[str] = field(default_factory=list)
    is_on_boundary: bool = False
    boundary_source: str = ""
    boundary_conclusion: str = ""
    status: ReviewStatus = ReviewStatus.PENDING
    complaint_id: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    review_records: List[ReviewRecord] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    service_radius: float = 500.0

    @property
    def type_label(self) -> str:
        parts = []
        if self.is_night_sampling:
            parts.append("夜间采样")
        if self.is_on_boundary:
            parts.append("边界点位")
        if not parts:
            parts.append("常规点位")
        return " + ".join(parts)

    def _add_review_record(self, action: str, operator: str, note: str = "",
                           before_status: Optional[str] = None,
                           after_status: Optional[str] = None,
                           field_changes: Optional[List[FieldChange]] = None,
                           affected_result: str = "") -> ReviewRecord:
        record = ReviewRecord(
            id=f"REC-{len(self.review_records) + 1:03d}",
            point_id=self.id,
            action=action,
            operator=operator,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            note=note,
            before_status=before_status,
            after_status=after_status,
            field_changes=field_changes or [],
            affected_result=affected_result
        )
        self.review_records.append(record)
        return record

    def add_complaint(self, complaint: Complaint):
        before = self.status.value
        changes = [
            FieldChange("complaint_id", "关联投诉", self.complaint_id, complaint.id),
            FieldChange("status", "复核状态", before, ReviewStatus.COMPLAINT_ADDED.value)
        ]
        self.complaint_id = complaint.id
        self.status = ReviewStatus.COMPLAINT_ADDED
        self._add_review_record(
            action="补录居民投诉",
            operator="社区书记周姐",
            note=f"补录投诉编号：{complaint.complaint_no}，{complaint.description}",
            before_status=before,
            after_status=self.status.value,
            field_changes=changes,
            affected_result=f"点位 {self.name} 的投诉关联状态从「无」变为「{complaint.complaint_no}」"
        )

    def mark_boundary(self, street_names: List[str]):
        before_is_boundary = self.is_on_boundary
        before_status = self.status.value
        self.is_on_boundary = True
        self.boundary_source = f"系统检测：点位位于{'、'.join(street_names)}街道交界处"
        self.status = ReviewStatus.BOUNDARY_PENDING
        changes = [
            FieldChange("is_on_boundary", "边界标记", str(before_is_boundary), "True"),
            FieldChange("boundary_source", "边界来源", "", self.boundary_source),
            FieldChange("status", "复核状态", before_status, self.status.value)
        ]
        self._add_review_record(
            action="识别为边界点位",
            operator="系统自动检测",
            note=f"点位位于{'、'.join(street_names)}交界处，留待项目经理复核",
            before_status=before_status,
            after_status=self.status.value,
            field_changes=changes,
            affected_result=f"点位 {self.name} 被标记为边界待确认，服务半径覆盖跨街道区域"
        )

    def confirm_boundary(self, operator: str, conclusion: str):
        before_status = self.status.value
        self.status = ReviewStatus.CONFIRMED
        self.boundary_conclusion = conclusion
        changes = [
            FieldChange("status", "复核状态", before_status, self.status.value),
            FieldChange("boundary_conclusion", "边界结论", "", conclusion)
        ]
        self._add_review_record(
            action="边界复核确认",
            operator=operator,
            note=conclusion,
            before_status=before_status,
            after_status=self.status.value,
            field_changes=changes,
            affected_result=f"点位 {self.name} 边界归属已确认：{conclusion}"
        )

    def manual_fix(self, operator: str, note: str):
        before_status = self.status.value
        changes = [
            FieldChange("status", "复核状态", before_status, ReviewStatus.MANUAL_FIXED.value),
            FieldChange("notes", "备注/误差说明", "；".join(self.notes) if self.notes else "(空)", note)
        ]
        self.status = ReviewStatus.MANUAL_FIXED
        self.notes.append(note)
        self._add_review_record(
            action="人工修正",
            operator=operator,
            note=note,
            before_status=before_status,
            after_status=self.status.value,
            field_changes=changes,
            affected_result=f"点位 {self.name} 经人工修正，备注变更为：{note}"
        )

    def re_run(self, operator: str):
        before_status = self.status.value
        changes = [
            FieldChange("status", "复核状态", before_status, ReviewStatus.RE_RUN.value)
        ]
        self.status = ReviewStatus.RE_RUN
        self._add_review_record(
            action="重跑复核",
            operator=operator,
            note="重新计算服务半径覆盖范围",
            before_status=before_status,
            after_status=self.status.value,
            field_changes=changes,
            affected_result=f"点位 {self.name} 重新计算服务半径，结果已更新"
        )
