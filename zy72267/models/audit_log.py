from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class AuditAction(str, Enum):
    IMPORT_POINT_CLOUD = "导入点云抽稀日志"
    IMPORT_COORDINATE = "导入坐标表"
    DETECT_DUPLICATE = "检测到重复导入"
    DETECT_MISSING_COORDINATE = "检测到照片有点位但坐标表缺行"
    SUPPLEMENT_COORDINATE = "补录坐标"
    CHECK_SAFETY_RADIUS = "核对安全半径"
    UPDATE_OCCLUSION = "更新遮挡点清单"
    MANUAL_MODIFY = "人工修改数据"
    SUBMIT_FOR_REVIEW = "提交安全员复核"
    SAFETY_REVIEW_APPROVE = "安全员复核通过（正常）"
    SAFETY_REVIEW_REJECT = "安全员复核不通过（异常）"
    EXPORT_DATA = "导出数据"
    RECALCULATE = "补录后重算"
    CHECK_EXPORT_CONSISTENCY = "导出一致性检查"


@dataclass
class AuditLog:
    log_id: str
    action: AuditAction
    batch_id: str
    point_id: Optional[str] = None
    operator: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    original_value: Optional[str] = None
    new_value: Optional[str] = None
    original_line_number: Optional[int] = None
    remark: str = ""

    @classmethod
    def create(cls, action: AuditAction, batch_id: str,
               point_id: Optional[str] = None,
               operator: str = "小陶",
               original_value: Optional[str] = None,
               new_value: Optional[str] = None,
               original_line_number: Optional[int] = None,
               remark: str = "") -> "AuditLog":
        return cls(
            log_id=str(uuid.uuid4()),
            action=action,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            original_value=original_value,
            new_value=new_value,
            original_line_number=original_line_number,
            remark=remark
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "action": self.action.value,
            "batch_id": self.batch_id,
            "point_id": self.point_id,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "original_value": self.original_value,
            "new_value": self.new_value,
            "original_line_number": self.original_line_number,
            "remark": self.remark
        }
