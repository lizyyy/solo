from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any
from app.models import (
    UserRole, AlertType, AlertStatus, InspectionStatus,
    WorkOrderStatus, DataQuality
)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: UserRole = UserRole.READ_ONLY


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class ChargingPileBase(BaseModel):
    pile_code: str
    pile_name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    install_date: Optional[datetime] = None
    is_online: bool = True


class ChargingPileCreate(ChargingPileBase):
    pass


class ChargingPileUpdate(BaseModel):
    pile_name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    is_online: Optional[bool] = None


class ChargingPile(ChargingPileBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PileAlertBase(BaseModel):
    pile_id: int
    alert_type: AlertType
    alert_code: Optional[str] = None
    alert_message: Optional[str] = None
    alert_level: int = 1
    status: AlertStatus = AlertStatus.ACTIVE
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None


class PileAlertCreate(PileAlertBase):
    pass


class PileAlertUpdate(BaseModel):
    alert_type: Optional[AlertType] = None
    alert_code: Optional[str] = None
    alert_message: Optional[str] = None
    alert_level: Optional[int] = None
    status: Optional[AlertStatus] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    data_quality: Optional[DataQuality] = None
    quality_issue: Optional[str] = None


class PileAlert(PileAlertBase):
    id: int
    data_quality: DataQuality
    quality_issue: Optional[str] = None
    created_by: Optional[int] = None
    reviewed_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    charging_pile: Optional[ChargingPile] = None

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    pile_id: int
    inspection_date: datetime
    inspector: Optional[str] = None
    status: InspectionStatus = InspectionStatus.NORMAL
    inspection_items: Optional[str] = None
    abnormal_items: Optional[str] = None
    remarks: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionUpdate(BaseModel):
    inspection_date: Optional[datetime] = None
    inspector: Optional[str] = None
    status: Optional[InspectionStatus] = None
    inspection_items: Optional[str] = None
    abnormal_items: Optional[str] = None
    remarks: Optional[str] = None
    data_quality: Optional[DataQuality] = None
    quality_issue: Optional[str] = None


class Inspection(InspectionBase):
    id: int
    data_quality: DataQuality
    quality_issue: Optional[str] = None
    created_by: Optional[int] = None
    reviewed_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    charging_pile: Optional[ChargingPile] = None

    class Config:
        from_attributes = True


class CustomerComplaintBase(BaseModel):
    complaint_no: str
    pile_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    complaint_type: Optional[str] = None
    complaint_content: Optional[str] = None
    complaint_time: datetime
    handler: Optional[str] = None
    handle_result: Optional[str] = None
    handle_time: Optional[datetime] = None


class CustomerComplaintCreate(CustomerComplaintBase):
    pass


class CustomerComplaintUpdate(BaseModel):
    pile_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    complaint_type: Optional[str] = None
    complaint_content: Optional[str] = None
    handler: Optional[str] = None
    handle_result: Optional[str] = None
    handle_time: Optional[datetime] = None
    data_quality: Optional[DataQuality] = None
    quality_issue: Optional[str] = None


class CustomerComplaint(CustomerComplaintBase):
    id: int
    data_quality: DataQuality
    quality_issue: Optional[str] = None
    created_by: Optional[int] = None
    reviewed_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupervisorCommentBase(BaseModel):
    related_type: str
    related_id: int
    supervisor: str
    comment: str


class SupervisorCommentCreate(SupervisorCommentBase):
    pass


class SupervisorComment(SupervisorCommentBase):
    id: int
    comment_time: datetime
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderBase(BaseModel):
    order_no: str
    pile_id: int
    alert_id: Optional[int] = None
    order_type: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: WorkOrderStatus = WorkOrderStatus.PENDING
    assignee: Optional[str] = None
    priority: int = 1
    due_date: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    order_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[WorkOrderStatus] = None
    assignee: Optional[str] = None
    priority: Optional[int] = None
    due_date: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None


class WorkOrder(WorkOrderBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    charging_pile: Optional[ChargingPile] = None
    alert: Optional[PileAlert] = None

    class Config:
        from_attributes = True


class ReconciliationBase(BaseModel):
    recon_date: datetime
    pile_id: Optional[int] = None
    alert_id: Optional[int] = None
    inspection_id: Optional[int] = None
    complaint_id: Optional[int] = None
    work_order_id: Optional[int] = None
    recon_status: Optional[str] = None
    recon_result: Optional[str] = None
    fault_duration_minutes: Optional[float] = None
    monthly_fault_duration: Optional[float] = None
    remarks: Optional[str] = None


class ReconciliationCreate(ReconciliationBase):
    pass


class Reconciliation(ReconciliationBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FailedDataBase(BaseModel):
    data_type: str
    source_data: str
    error_message: str


class FailedDataCreate(FailedDataBase):
    pass


class FailedDataUpdate(BaseModel):
    retried: Optional[bool] = None
    resolved: Optional[bool] = None


class FailedData(FailedDataBase):
    id: int
    failed_at: datetime
    retried: bool
    resolved: bool
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    method: Optional[str] = None
    path: Optional[str] = None
    request_data: Optional[str] = None
    response_data: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    user_id: Optional[int] = None


class AuditLog(AuditLogBase):
    id: int
    user_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class PlaybackRecordBase(BaseModel):
    pile_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    playback_type: Optional[str] = None
    parameters: Optional[str] = None
    result: Optional[str] = None


class PlaybackRecordCreate(PlaybackRecordBase):
    pass


class PlaybackRecord(PlaybackRecordBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DataQualityCheck(BaseModel):
    resource_type: str
    resource_id: int
    is_valid: bool
    issues: List[str] = []


class ReconciliationLink(BaseModel):
    alert_id: int
    inspection_id: Optional[int] = None
    complaint_id: Optional[int] = None
    work_order_id: Optional[int] = None
    comments: Optional[List[SupervisorComment]] = None


class MonthlyReportItem(BaseModel):
    pile_id: int
    pile_code: str
    pile_name: str
    area: str
    fault_count: int
    total_duration_minutes: float
    avg_duration_minutes: float
    offline_count: int
    abnormal_count: int
    complaint_count: int
    work_order_count: int


class GenericResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
