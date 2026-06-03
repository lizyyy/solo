from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class ReviewStatus(str, Enum):
    INITIAL = "待复核"
    PHOTO_HAS_POINT_NO_COORDINATE = "照片有标记但坐标表缺行"
    COORDINATE_SUPPLEMENTED = "坐标已补录"
    SAFETY_CHECKED = "安全半径已核对"
    OCCLUSION_UPDATED = "遮挡点清单已更新"
    SAFETY_REVIEW_PENDING = "待安全员复核"
    NORMAL = "正常"
    ABNORMAL = "异常"
    EXPORTED = "已导出"


class ReviewIssue(str, Enum):
    NONE = "无问题"
    DUPLICATE_IMPORT = "重复导入"
    PHOTO_HAS_POINT_NO_COORDINATE = "照片有点位但坐标表缺一行"
    SAFETY_RADIUS_VIOLATION = "安全半径不满足"
    MANUAL_MODIFICATION = "人工改动过"
    SUPPLEMENTED_COORDINATE = "坐标为补录"


@dataclass
class ReviewRecord:
    review_id: str
    batch_id: str
    point_id: str
    status: ReviewStatus = ReviewStatus.INITIAL
    issues: List[ReviewIssue] = field(default_factory=list)
    point_cloud_log_record_id: str = ""
    coordinate_record_id: Optional[str] = None
    photo_point_id: str = ""
    safety_radius_record_id: Optional[str] = None
    occlusion_record_id: Optional[str] = None
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None
    safety_reviewed_by: str = ""
    safety_reviewed_at: Optional[datetime] = None
    remarks: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(cls, batch_id: str, point_id: str,
               point_cloud_log_record_id: str,
               photo_point_id: str,
               reviewed_by: str = "小陶") -> "ReviewRecord":
        return cls(
            review_id=str(uuid.uuid4()),
            batch_id=batch_id,
            point_id=point_id,
            point_cloud_log_record_id=point_cloud_log_record_id,
            photo_point_id=photo_point_id,
            reviewed_by=reviewed_by
        )

    def add_issue(self, issue: ReviewIssue):
        if issue not in self.issues:
            self.issues.append(issue)
            self.updated_at = datetime.now()

    def remove_issue(self, issue: ReviewIssue):
        if issue in self.issues:
            self.issues.remove(issue)
            self.updated_at = datetime.now()

    def update_status(self, status: ReviewStatus, operator: str = "小陶"):
        self.status = status
        self.updated_at = datetime.now()
        if status == ReviewStatus.SAFETY_REVIEW_PENDING and not self.safety_reviewed_by:
            self.reviewed_by = operator
            self.reviewed_at = datetime.now()
        elif status == ReviewStatus.NORMAL or status == ReviewStatus.ABNORMAL:
            if self.safety_reviewed_by == "":
                self.safety_reviewed_by = operator
                self.safety_reviewed_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "review_id": self.review_id,
            "batch_id": self.batch_id,
            "point_id": self.point_id,
            "status": self.status.value,
            "issues": [i.value for i in self.issues],
            "point_cloud_log_record_id": self.point_cloud_log_record_id,
            "coordinate_record_id": self.coordinate_record_id,
            "photo_point_id": self.photo_point_id,
            "safety_radius_record_id": self.safety_radius_record_id,
            "occlusion_record_id": self.occlusion_record_id,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "safety_reviewed_by": self.safety_reviewed_by,
            "safety_reviewed_at": self.safety_reviewed_at.isoformat() if self.safety_reviewed_at else None,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
