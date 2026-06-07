from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple
from enum import Enum


class PointType(str, Enum):
    NORMAL = "normal"
    NIGHT_SAMPLING = "night_sampling"
    BOUNDARY = "boundary"


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
class ReviewRecord:
    id: str
    point_id: str
    action: str
    operator: str
    timestamp: str
    note: str = ""
    before_status: Optional[str] = None
    after_status: Optional[str] = None


@dataclass
class Point:
    id: str
    name: str
    lng: float
    lat: float
    address: str
    point_type: PointType = PointType.NORMAL
    street_ids: List[str] = field(default_factory=list)
    is_on_boundary: bool = False
    status: ReviewStatus = ReviewStatus.PENDING
    complaint_id: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    review_records: List[ReviewRecord] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    service_radius: float = 500.0

    def add_review_record(self, action: str, operator: str, note: str = "",
                          before_status: Optional[str] = None,
                          after_status: Optional[str] = None):
        record = ReviewRecord(
            id=f"REC-{len(self.review_records) + 1:03d}",
            point_id=self.id,
            action=action,
            operator=operator,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            note=note,
            before_status=before_status,
            after_status=after_status
        )
        self.review_records.append(record)

    def add_complaint(self, complaint: Complaint):
        self.complaint_id = complaint.id
        before = self.status.value
        self.status = ReviewStatus.COMPLAINT_ADDED
        self.add_review_record(
            action="补录居民投诉",
            operator="社区书记周姐",
            note=f"补录投诉编号：{complaint.complaint_no}，{complaint.description}",
            before_status=before,
            after_status=self.status.value
        )

    def mark_boundary(self, street_names: List[str]):
        self.is_on_boundary = True
        self.point_type = PointType.BOUNDARY
        before = self.status.value
        self.status = ReviewStatus.BOUNDARY_PENDING
        self.add_review_record(
            action="识别为边界点位",
            operator="系统自动检测",
            note=f"点位位于{ '、'.join(street_names) }交界处，留待项目经理复核",
            before_status=before,
            after_status=self.status.value
        )

    def manual_fix(self, operator: str, note: str):
        before = self.status.value
        self.status = ReviewStatus.MANUAL_FIXED
        self.add_review_record(
            action="人工修正",
            operator=operator,
            note=note,
            before_status=before,
            after_status=self.status.value
        )

    def re_run(self, operator: str):
        before = self.status.value
        self.status = ReviewStatus.RE_RUN
        self.add_review_record(
            action="重跑复核",
            operator=operator,
            note="重新计算服务半径覆盖范围",
            before_status=before,
            after_status=self.status.value
        )
