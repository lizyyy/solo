from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class TransformationStatus(Enum):
    NOT_STARTED = "未开始"
    IN_PROGRESS = "进行中"
    COMPLETED = "已完成"
    DELAYED = "已延期"
    REJECTED = "已拒绝"


class ExtensionApprovalStatus(Enum):
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"


@dataclass
class Caller:
    caller_name: str
    api_name: str
    transformation_plan: str
    planned_complete_date: Optional[str] = None
    status: TransformationStatus = TransformationStatus.NOT_STARTED
    registered_at: datetime = field(default_factory=datetime.now)
    remarks: Optional[str] = None

    def to_dict(self):
        return {
            "caller_name": self.caller_name,
            "api_name": self.api_name,
            "transformation_plan": self.transformation_plan,
            "planned_complete_date": self.planned_complete_date,
            "status": self.status.value,
            "registered_at": self.registered_at.isoformat(),
            "remarks": self.remarks
        }


@dataclass
class ExtensionRequest:
    caller_name: str
    api_name: str
    original_decommission_date: str
    requested_decommission_date: str
    reason: str
    approval_status: ExtensionApprovalStatus = ExtensionApprovalStatus.PENDING
    requested_at: datetime = field(default_factory=datetime.now)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    def to_dict(self):
        return {
            "caller_name": self.caller_name,
            "api_name": self.api_name,
            "original_decommission_date": self.original_decommission_date,
            "requested_decommission_date": self.requested_decommission_date,
            "reason": self.reason,
            "approval_status": self.approval_status.value,
            "requested_at": self.requested_at.isoformat(),
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None
        }


@dataclass
class ApiDecommission:
    api_name: str
    decommission_date: str
    callers: List[Caller] = field(default_factory=list)
    extension_requests: List[ExtensionRequest] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self):
        return {
            "api_name": self.api_name,
            "decommission_date": self.decommission_date,
            "callers": [caller.to_dict() for caller in self.callers],
            "extension_requests": [ext.to_dict() for ext in self.extension_requests],
            "created_at": self.created_at.isoformat()
        }


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"

    def to_dict(self):
        return {
            "field": self.field,
            "message": self.message,
            "severity": self.severity
        }
