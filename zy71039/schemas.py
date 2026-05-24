from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from database import LeakLevelEnum, WorkOrderStatusEnum, HandlerRoleEnum
from decimal import Decimal


class RoofAreaBase(BaseModel):
    name: str = Field(..., max_length=100)
    building: Optional[str] = None
    floor: Optional[str] = None
    area_size: Optional[float] = None
    description: Optional[str] = None


class RoofAreaCreate(RoofAreaBase):
    pass


class RoofArea(RoofAreaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class InspectionPointBase(BaseModel):
    roof_area_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    position_desc: Optional[str] = Field(None, max_length=200)


class InspectionPointCreate(InspectionPointBase):
    pass


class InspectionPoint(InspectionPointBase):
    id: int
    point_code: str
    cluster_key: Optional[str] = None
    merge_count: int
    first_detected_at: datetime
    last_detected_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RawMaterialBase(BaseModel):
    thermal_image_path: Optional[str] = None
    visible_image_path: Optional[str] = None
    leak_level: LeakLevelEnum
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    inspector: Optional[str] = None
    inspection_time: Optional[datetime] = None
    equipment_info: Optional[str] = None
    weather: Optional[str] = None
    notes: Optional[str] = None
    source_batch: Optional[str] = None


class RawMaterialCreate(RawMaterialBase):
    roof_area_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    position_desc: Optional[str] = None
    point_code: Optional[str] = None


class RawMaterial(RawMaterialBase):
    id: int
    material_code: str
    inspection_point_id: Optional[int] = None
    is_merged: bool
    merged_into_point_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderBase(BaseModel):
    description: Optional[str] = None
    priority: int = 1
    deadline: Optional[datetime] = None
    assigned_to: Optional[str] = None


class WorkOrderCreate(WorkOrderBase):
    inspection_point_id: int
    material_ids: Optional[List[int]] = None


class WorkOrder(WorkOrderBase):
    id: int
    order_no: str
    inspection_point_id: int
    current_level: LeakLevelEnum
    status: WorkOrderStatusEnum
    handler_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    final_conclusion: Optional[str] = None

    class Config:
        from_attributes = True


class JudgmentRecordBase(BaseModel):
    judgment_type: str = Field(..., max_length=50)
    judged_level: LeakLevelEnum
    judge: str
    reason: Optional[str] = None
    evidence: Optional[str] = None


class JudgmentRecordCreate(JudgmentRecordBase):
    work_order_id: int


class JudgmentRecord(JudgmentRecordBase):
    id: int
    work_order_id: int
    previous_level: Optional[LeakLevelEnum] = None
    judgment_time: datetime

    class Config:
        from_attributes = True


class RetestRecordBase(BaseModel):
    retester: str
    result: str
    thermal_image_path: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    description: Optional[str] = None
    is_passed: bool


class RetestRecordCreate(RetestRecordBase):
    work_order_id: int
    retest_time: Optional[datetime] = None


class RetestRecord(RetestRecordBase):
    id: int
    work_order_id: int
    retest_no: str
    retest_time: datetime

    class Config:
        from_attributes = True


class StatusTransitionBase(BaseModel):
    from_status: WorkOrderStatusEnum
    to_status: WorkOrderStatusEnum
    operator: str
    reason: Optional[str] = None


class StatusTransitionCreate(StatusTransitionBase):
    work_order_id: int


class StatusTransition(StatusTransitionBase):
    id: int
    work_order_id: int
    transition_time: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    operator: str
    reason: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    inspection_point_id: Optional[int] = None
    work_order_id: Optional[int] = None


class AuditLog(AuditLogBase):
    id: int
    inspection_point_id: Optional[int] = None
    work_order_id: Optional[int] = None
    operation_time: datetime

    class Config:
        from_attributes = True


class HandlerBase(BaseModel):
    username: str = Field(..., max_length=50)
    real_name: Optional[str] = None
    role: HandlerRoleEnum
    phone: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None


class HandlerCreate(HandlerBase):
    pass


class Handler(HandlerBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PointMergeRequest(BaseModel):
    source_point_ids: List[int]
    target_point_id: int
    operator: str
    reason: Optional[str] = None


class WorkOrderJudgmentRequest(BaseModel):
    work_order_id: int
    judged_level: LeakLevelEnum
    judge: str
    judgment_type: str = "manual"
    reason: Optional[str] = None
    evidence: Optional[str] = None


class WorkOrderStatusUpdateRequest(BaseModel):
    work_order_id: int
    new_status: WorkOrderStatusEnum
    operator: str
    reason: Optional[str] = None


class MaterialSupplementRequest(BaseModel):
    work_order_id: int
    material_id: int
    operator: str
    is_primary: bool = False


class ReportQueryRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    roof_area_id: Optional[int] = None
    status: Optional[WorkOrderStatusEnum] = None
    leak_level: Optional[LeakLevelEnum] = None


class PointMergeResult(BaseModel):
    success: bool
    target_point_id: int
    merged_count: int
    message: str


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
