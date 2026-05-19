from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from models import SwitchStatus, HealthStatus


class DomainBase(BaseModel):
    domain_name: str
    primary_origin: str
    backup_origin: str
    health_check_url: Optional[str] = None
    health_check_interval: int = 60
    success_threshold: int = 3
    failure_threshold: int = 3


class DomainCreate(DomainBase):
    pass


class Domain(DomainBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SwitchRecordBase(BaseModel):
    domain_id: int
    switch_reason: str
    restore_condition: Optional[str] = None
    created_by: str


class SwitchRecordCreate(SwitchRecordBase):
    pass


class SwitchRecordUpdate(BaseModel):
    switch_reason: Optional[str] = None
    restore_condition: Optional[str] = None


class SwitchRecord(SwitchRecordBase):
    id: int
    status: SwitchStatus
    switched_at: Optional[datetime] = None
    restored_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthCheckBase(BaseModel):
    target_origin: str
    status: HealthStatus
    response_time: Optional[int] = None
    status_code: Optional[int] = None
    error_message: Optional[str] = None


class HealthCheckCreate(HealthCheckBase):
    switch_record_id: int


class HealthCheck(HealthCheckBase):
    id: int
    check_time: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    operator: str
    original_input: Optional[str] = None
    conclusion: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    switch_record_id: int


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SwitchRecordDetail(SwitchRecord):
    domain: Domain
    health_checks: List[HealthCheck] = []
    operations: List[OperationLog] = []


class SwitchReport(BaseModel):
    switch_record_id: int
    domain_name: str
    primary_origin: str
    backup_origin: str
    switch_reason: str
    restore_condition: Optional[str]
    status: SwitchStatus
    created_by: str
    created_at: datetime
    switched_at: Optional[datetime] = None
    restored_at: Optional[datetime] = None
    total_health_checks: int
    successful_checks: int
    failed_checks: int
    operations: List[OperationLog] = []


class ManualCorrectRequest(BaseModel):
    target_status: SwitchStatus
    operator: str
    reason: str
    original_input: Optional[str] = None