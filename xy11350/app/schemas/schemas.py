from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    QUALITY_CONTROL = "quality_control"
    OPERATOR = "operator"


class BatchStatus(str, Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    REWORK = "rework"


class ErrorStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    role: str = "operator"


class UserCreate(UserBase):
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PrintBatchBase(BaseModel):
    batch_number: str = Field(..., description="批次号")
    paper_batch: str = Field(..., description="纸张批次")
    product_name: Optional[str] = None
    customer_info: Optional[str] = None
    operator_id: Optional[str] = None
    cost_details: Optional[str] = None
    status: str = "pending"


class PrintBatchCreate(PrintBatchBase):
    pass


class PrintBatchUpdate(BaseModel):
    paper_batch: Optional[str] = None
    product_name: Optional[str] = None
    customer_info: Optional[str] = None
    operator_id: Optional[str] = None
    cost_details: Optional[str] = None
    status: Optional[str] = None


class PrintBatchResponse(BaseModel):
    id: int
    batch_number: str
    paper_batch: str
    product_name: Optional[str]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LabRecordBase(BaseModel):
    batch_number: str
    l_value: float = Field(..., description="L*值")
    a_value: float = Field(..., description="a*值")
    b_value: float = Field(..., description="b*值")
    delta_e: Optional[float] = None
    measurement_point: Optional[str] = None
    measured_at: Optional[datetime] = None
    operator_id: Optional[str] = None


class LabRecordCreate(LabRecordBase):
    pass


class LabRecordResponse(BaseModel):
    id: int
    batch_id: int
    l_value: float
    a_value: float
    b_value: float
    delta_e: Optional[float]
    measurement_point: Optional[str]
    measured_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_number: str
    batch_number: str
    product_spec: Optional[str] = None
    quantity: Optional[int] = None
    customer_info: Optional[str] = None
    cost_details: Optional[str] = None
    delivery_date: Optional[datetime] = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(BaseModel):
    id: int
    batch_id: int
    order_number: str
    product_spec: Optional[str]
    quantity: Optional[int]
    delivery_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    customer_info: Optional[str]
    cost_details: Optional[str]


class ReworkRecordBase(BaseModel):
    batch_number: str
    reason: str
    rework_type: Optional[str] = None
    operator_id: Optional[str] = None
    notes: Optional[str] = None
    reworked_at: Optional[datetime] = None


class ReworkRecordCreate(ReworkRecordBase):
    pass


class ReworkRecordResponse(BaseModel):
    id: int
    batch_id: int
    reason: str
    rework_type: Optional[str]
    notes: Optional[str]
    reworked_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorRecordResponse(BaseModel):
    id: int
    import_session_id: str
    source_file: str
    row_number: Optional[int]
    raw_data: str
    error_type: str
    error_message: str
    suggestion: Optional[str]
    status: str
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorRecordResolve(BaseModel):
    status: str
    suggestion: Optional[str] = None


class ImportRecordResponse(BaseModel):
    id: int
    file_name: str
    import_type: str
    total_records: int
    success_count: int
    error_count: int
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class BatchHistoryResponse(BaseModel):
    id: int
    batch_id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_by: Optional[str]
    changed_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    session_id: str
    total_records: int
    success_count: int
    error_count: int
    message: str


class PrintBatchDetailResponse(PrintBatchResponse):
    customer_info: Optional[str]
    operator_id: Optional[str]
    cost_details: Optional[str]
    lab_records: List[LabRecordResponse] = []
    orders: List[OrderResponse] = []
    rework_records: List[ReworkRecordResponse] = []
