from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class UserRole(str, Enum):
    SITE_LEADER = "现场负责人"
    BACKEND_REVIEWER = "后台复核人"
    OPERATOR = "操作员"


class QueueStatus(str, Enum):
    PENDING_QUEUE = "待排队"
    QUEUED = "已排队"
    ASSIGNED_TO_POT = "已分配锅次"
    BOILING = "煎煮中"
    BOILED = "煎煮完成"
    PACKING = "包装中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"
    EXCEPTION = "异常"


class PrescriptionCreate(BaseModel):
    prescription_no: str
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_id_card: Optional[str] = None
    department: Optional[str] = None
    doctor_name: Optional[str] = None
    diagnosis: Optional[str] = None
    herbal_items: str
    total_doses: int
    decoction_type: str = "常规煎煮"
    special_instructions: Optional[str] = None
    priority: int = 0
    submit_source: str
    submitted_by: str


class QueueEntryResponse(BaseModel):
    id: int
    queue_no: str
    prescription_id: int
    status: str
    pot_id: Optional[int] = None
    queue_position: Optional[int] = None
    is_same_pot: bool
    same_pot_group_id: Optional[str] = None
    cancellation_requested: bool
    exception_flag: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class QueueEntryDetail(QueueEntryResponse):
    patient_name: str
    prescription_no: str
    total_doses: int
    diagnosis: Optional[str] = None
    doctor_name: Optional[str] = None


class StatusHistoryResponse(BaseModel):
    id: int
    from_status: Optional[str] = None
    to_status: str
    action: str
    performed_by: str
    performed_by_role: str
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ActionRequest(BaseModel):
    performed_by: str
    notes: Optional[str] = None


class AssignPotRequest(ActionRequest):
    pot_id: int
    same_pot_group_id: Optional[str] = None


class CancellationRequest(ActionRequest):
    reason: str


class ExceptionHandleRequest(ActionRequest):
    exception_notes: str
    new_status: Optional[str] = None


class SamePotGroupResponse(BaseModel):
    group_id: str
    pot_id: Optional[int] = None
    status: str
    total_prescriptions: int
    active_prescriptions: int
    prescriptions: List[QueueEntryDetail] = []
    
    class Config:
        from_attributes = True
