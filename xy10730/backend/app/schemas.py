from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import HealthStatus, CheckStatus, ServiceStatus


class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    service_type: Optional[str] = None
    status: ServiceStatus = ServiceStatus.ONLINE
    health_check_url: Optional[str] = None
    dependencies: Optional[Dict[str, Any]] = None
    owner: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    description: Optional[str] = None
    service_type: Optional[str] = None
    status: Optional[ServiceStatus] = None
    health_check_url: Optional[str] = None
    dependencies: Optional[Dict[str, Any]] = None
    owner: Optional[str] = None


class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthRecordBase(BaseModel):
    service_id: int
    health_status: HealthStatus
    check_status: CheckStatus
    probe_result: Optional[Dict[str, Any]] = None
    dependency_check_result: Optional[Dict[str, Any]] = None
    error_details: Optional[str] = None
    fault_level: Optional[str] = None


class HealthRecordCreate(HealthRecordBase):
    request_id: str


class HealthRecordReview(BaseModel):
    reviewed_by: str
    review_comment: Optional[str] = None
    check_status: Optional[CheckStatus] = None


class HealthRecordConfirmRecovery(BaseModel):
    confirmed_by: str
    review_comment: Optional[str] = None


class HealthRecordResponse(HealthRecordBase):
    id: int
    request_id: str
    check_time: datetime
    is_idempotent: bool
    retry_count: int
    reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    recovery_confirmed: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    service: ServiceResponse

    class Config:
        from_attributes = True


class DutyReportBase(BaseModel):
    record_id: Optional[int] = None
    reporter: str
    report_content: str


class DutyReportCreate(DutyReportBase):
    pass


class DutyReportHandle(BaseModel):
    handler: str
    handle_comment: Optional[str] = None
    handle_status: str = "handled"


class DutyReportResponse(DutyReportBase):
    id: int
    report_time: datetime
    handle_status: str
    handler: Optional[str] = None
    handle_time: Optional[datetime] = None
    handle_comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class HealthCheckRequest(BaseModel):
    service_id: int
    request_id: str
    probe_result: Optional[Dict[str, Any]] = None
    dependency_check_result: Optional[Dict[str, Any]] = None


class ApiResponse(BaseModel):
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None


class FilterParams(BaseModel):
    service_id: Optional[int] = None
    health_status: Optional[HealthStatus] = None
    check_status: Optional[CheckStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reviewed: Optional[bool] = None
    page: int = 1
    page_size: int = 20
