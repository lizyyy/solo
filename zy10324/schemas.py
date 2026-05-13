from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import DetectionStatus, RiskLevel, Environment, AuthType
import uuid


def generate_task_id():
    return f"task_{uuid.uuid4().hex[:12]}"


class ApiInventoryBase(BaseModel):
    api_path: str
    method: str
    service_name: Optional[str] = None
    description: Optional[str] = None
    environment: Environment


class ApiInventoryCreate(ApiInventoryBase):
    pass


class ApiInventory(ApiInventoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DetectionTaskBase(BaseModel):
    pass


class DetectionTaskCreate(BaseModel):
    api_inventory_id: int
    handler: Optional[str] = None


class DetectionTask(DetectionTaskBase):
    id: int
    task_id: str
    api_inventory_id: int
    status: DetectionStatus
    current_handler: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    risk_tags: Optional[str] = None
    auth_type: Optional[AuthType] = None
    auth_configured: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    api_inventory: Optional[ApiInventory] = None

    class Config:
        from_attributes = True


class DetectionTaskDetail(DetectionTask):
    scan_result: Optional[str] = None
    auth_check_result: Optional[str] = None
    risk_assessment_result: Optional[str] = None
    close_confirmation_result: Optional[str] = None


class DetectionHistoryBase(BaseModel):
    pass


class DetectionHistory(DetectionHistoryBase):
    id: int
    task_id: int
    from_status: Optional[DetectionStatus] = None
    to_status: DetectionStatus
    handler: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CloseRecordBase(BaseModel):
    pass


class CloseRecordCreate(BaseModel):
    closed_by: str
    close_evidence: str
    conclusion: str


class CloseRecord(CloseRecordBase):
    id: int
    task_id: int
    closed_by: str
    close_evidence: str
    close_time: datetime
    conclusion: str

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    handler: Optional[str] = None
    remark: Optional[str] = None


class ScanResultRequest(BaseModel):
    scan_result: str
    handler: Optional[str] = None


class AuthCheckRequest(BaseModel):
    auth_type: AuthType
    auth_configured: bool
    auth_check_result: str
    handler: Optional[str] = None


class RiskAssessmentRequest(BaseModel):
    risk_level: RiskLevel
    risk_tags: List[str]
    risk_assessment_result: str
    handler: Optional[str] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class TaskListResponse(BaseModel):
    total: int
    items: List[DetectionTask]


class InspectionReportBase(BaseModel):
    pass


class InspectionReport(InspectionReportBase):
    id: int
    report_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_apis: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    closed_count: int
    report_content: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
