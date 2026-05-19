from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

from src.models import (
    EquipmentType,
    OperationType,
    OperationStatus,
    ExceptionType,
    RoleType
)


class EquipmentBase(BaseModel):
    code: str = Field(..., max_length=50, description="设备编号")
    name: str = Field(..., max_length=100, description="设备名称")
    type: EquipmentType
    unit: str = Field(..., max_length=20, description="单位")
    description: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    total_quantity: int = Field(..., ge=0, description="总数量")


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None


class EquipmentResponse(EquipmentBase):
    id: int
    total_quantity: int
    available_quantity: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OperationBase(BaseModel):
    request_id: str = Field(..., max_length=100, description="请求ID，用于幂等校验")
    equipment_code: str
    quantity: int = Field(..., gt=0, description="数量")
    operator: str = Field(..., max_length=100, description="操作人")
    role: RoleType
    operated_at: Optional[datetime] = None
    remark: Optional[str] = None

    @validator('operated_at', pre=True, always=True)
    def set_operated_at(cls, v):
        return v or datetime.now()


class ImportOperation(OperationBase):
    operation_type: OperationType = OperationType.IMPORT


class OccupyOperation(OperationBase):
    operation_type: OperationType = OperationType.OCCUPY
    booth: str = Field(..., max_length=50, description="展位号")


class TransferOperation(OperationBase):
    operation_type: OperationType = OperationType.TRANSFER
    from_booth: str = Field(..., max_length=50, description="来源展位")
    to_booth: str = Field(..., max_length=50, description="目标展位")


class ReturnOperation(OperationBase):
    operation_type: OperationType = OperationType.RETURN
    booth: str = Field(..., max_length=50, description="展位号")


class LossOperation(OperationBase):
    operation_type: OperationType = OperationType.LOSS
    booth: Optional[str] = Field(None, max_length=50, description="展位号")
    loss_reason: Optional[str] = None


class BatchOperationRequest(BaseModel):
    operations: List[Dict[str, Any]]


class OperationRecordResponse(BaseModel):
    id: int
    request_id: str
    equipment_code: str
    equipment_name: str
    operation_type: OperationType
    quantity: int
    booth: Optional[str]
    from_booth: Optional[str]
    to_booth: Optional[str]
    operator: str
    role: RoleType
    status: OperationStatus
    exception_type: ExceptionType
    remark: Optional[str]
    operated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class BatchOperationResult(BaseModel):
    success_count: int
    failed_count: int
    results: List[Dict[str, Any]]


class QueryFilter(BaseModel):
    operator: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[OperationStatus] = None
    exception_type: Optional[ExceptionType] = None
    operation_type: Optional[OperationType] = None
    booth: Optional[str] = None
    equipment_code: Optional[str] = None


class ReportExportRequest(QueryFilter):
    format: str = Field(default="xlsx", description="导出格式: xlsx, csv")


class StockSnapshotResponse(BaseModel):
    equipment_code: str
    equipment_name: str
    type: EquipmentType
    total_quantity: int
    available_quantity: int
    unit: str
    snapshot_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    record_id: int
    action: str
    operator: str
    role: RoleType
    old_value: Optional[str]
    new_value: Optional[str]
    operated_at: datetime

    class Config:
        from_attributes = True
