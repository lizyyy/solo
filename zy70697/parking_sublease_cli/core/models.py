from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum


class LeaseStatus(Enum):
    VALID = "有效"
    INVALID_DATE = "日期无效"
    OVERLAPPING = "租期冲突"
    EARLY_TERMINATED = "已提前终止"
    EXPIRED = "已过期"


class AccessStatus(Enum):
    NOT_GRANTED = "未授权"
    GRANTED = "已授权"
    REVOKED = "已撤销"
    EXPIRED = "授权过期"


@dataclass
class SourceInfo:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int = 0
    original_data: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "sheet_name": self.sheet_name,
            "row_number": self.row_number,
            "original_data": self.original_data
        }


@dataclass
class ParkingSpace:
    space_id: str
    owner_id: str
    owner_name: str
    source: SourceInfo
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "space_id": self.space_id,
            "owner_id": self.owner_id,
            "owner_name": self.owner_name,
            "source": self.source.to_dict()
        }


@dataclass
class SubleaseRecord:
    record_id: str
    space_id: str
    owner_id: str
    owner_name: str
    tenant_id: str
    tenant_name: str
    tenant_phone: str
    start_date: datetime
    end_date: datetime
    monthly_fee: float
    actual_terminate_date: Optional[datetime] = None
    status: LeaseStatus = LeaseStatus.VALID
    access_status: AccessStatus = AccessStatus.NOT_GRANTED
    access_grant_date: Optional[datetime] = None
    access_revoke_date: Optional[datetime] = None
    source: SourceInfo = field(default_factory=lambda: SourceInfo(file_path=""))
    
    @property
    def lease_days(self) -> int:
        end = self.actual_terminate_date or self.end_date
        return max(0, (end - self.start_date).days + 1)
    
    @property
    def total_fee(self) -> float:
        if self.lease_days <= 0:
            return 0.0
        daily_fee = self.monthly_fee / 30.0
        return round(daily_fee * self.lease_days, 2)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "space_id": self.space_id,
            "owner_id": self.owner_id,
            "owner_name": self.owner_name,
            "tenant_id": self.tenant_id,
            "tenant_name": self.tenant_name,
            "tenant_phone": self.tenant_phone,
            "start_date": self.start_date.strftime("%Y-%m-%d"),
            "end_date": self.end_date.strftime("%Y-%m-%d"),
            "actual_terminate_date": self.actual_terminate_date.strftime("%Y-%m-%d") if self.actual_terminate_date else None,
            "monthly_fee": self.monthly_fee,
            "lease_days": self.lease_days,
            "total_fee": self.total_fee,
            "status": self.status.value,
            "access_status": self.access_status.value,
            "access_grant_date": self.access_grant_date.strftime("%Y-%m-%d") if self.access_grant_date else None,
            "access_revoke_date": self.access_revoke_date.strftime("%Y-%m-%d") if self.access_revoke_date else None,
            "source": self.source.to_dict()
        }


@dataclass
class ValidationResult:
    record_id: str
    is_valid: bool
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    source: SourceInfo = field(default_factory=lambda: SourceInfo(file_path=""))
    
    def add_error(self, message: str):
        self.errors.append(message)
        self.is_valid = False
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "source": self.source.to_dict()
        }


@dataclass
class BadRecord:
    file_path: str
    sheet_name: Optional[str]
    row_number: int
    original_data: str
    error_message: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "sheet_name": self.sheet_name,
            "row_number": self.row_number,
            "original_data": self.original_data,
            "error_message": self.error_message
        }
