"""数据模型定义

定义患者、标本、事件、异常等核心数据模型。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Optional, List


class SpecimenStatus(Enum):
    """标本状态枚举"""
    REGISTERED = "已登记"
    IN_PROCESS = "处理中"
    PENDING_PHOTO = "待拍照"
    PHOTO_COMPLETE = "拍照完成"
    PENDING_REVIEW = "待复核"
    REVIEWED = "已复核"
    RELEASED = "已放行"
    DELAYED = "已延迟"


class EventType(Enum):
    """事件类型枚举"""
    REGISTER = "登记"
    RECEIVE = "接收"
    PHOTOGRAPH = "拍照"
    REVIEW = "复核"
    RELEASE = "放行"
    DELAY = "延迟"
    PHONE_CALL = "电话"
    REMARK = "备注"


class AnomalyType(Enum):
    """异常类型枚举"""
    MULTI_PART_CONFUSION = "多部位混淆"
    MISSING_PHOTO = "缺照片"
    TIMEOUT = "超时未回报"
    MISSING_REVIEW = "漏复核签名"
    MISSING_SPECIMEN_BAG = "缺标本袋"
    MISSING_CSV = "缺申请单CSV"
    INCONSISTENT_INFO = "信息不一致"


@dataclass
class Patient:
    """患者信息"""
    id: Optional[int] = None
    patient_id: str = ""
    name: str = ""
    age: int = 0
    gender: str = ""
    bed_number: str = ""
    admission_number: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Specimen:
    """标本信息"""
    id: Optional[int] = None
    specimen_no: str = ""
    patient_id: str = ""
    patient_name: str = ""
    location: str = ""
    specimen_type: str = ""
    operation_room: str = ""
    surgeon: str = ""
    status: SpecimenStatus = SpecimenStatus.REGISTERED
    photo_count: int = 0
    has_csv: bool = False
    has_specimen_bag: bool = False
    phone_remark: str = ""
    urgent_level: str = "常规"
    registered_at: datetime = field(default_factory=datetime.now)
    reviewed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    due_time: Optional[datetime] = None
    reviewed_by: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class SpecimenEvent:
    """标本事件 - 用于时间线追踪"""
    id: Optional[int] = None
    specimen_id: int = 0
    event_type: EventType = EventType.REGISTER
    description: str = ""
    operator: str = ""
    event_time: datetime = field(default_factory=datetime.now)
    details: str = ""


@dataclass
class Anomaly:
    """异常记录"""
    id: Optional[int] = None
    specimen_id: int = 0
    anomaly_type: AnomalyType = AnomalyType.TIMEOUT
    description: str = ""
    severity: str = "high"
    detected_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    resolution: str = ""
    is_resolved: bool = False
