from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from database import ExceptionStatus, ExceptionType, ApprovalAction


class ErrorCode(str, Enum):
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_FORMAT = "INVALID_FORMAT"
    POLICY_NOT_FOUND = "POLICY_NOT_FOUND"
    EMPLOYEE_NOT_FOUND = "EMPLOYEE_NOT_FOUND"
    DESTINATION_NOT_FOUND = "DESTINATION_NOT_FOUND"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    CONFLICTING_REQUEST = "CONFLICTING_REQUEST"
    REQUIRES_MANUAL_REVIEW = "REQUIRES_MANUAL_REVIEW"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    field: Optional[str] = None
    suggestion: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: str
    details: List[ErrorDetail]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class EmployeeBase(BaseModel):
    id: str
    name: str
    email: str
    department: Optional[str] = None
    level: Optional[str] = None
    manager_id: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    created_at: datetime
    
    model_config = {"from_attributes": True}


class DestinationBase(BaseModel):
    id: str
    city_code: str
    city_name: str
    country: Optional[str] = None
    region: Optional[str] = None
    hotel_tier: Optional[str] = None
    flight_class_allowed: Optional[str] = None


class DestinationResponse(DestinationBase):
    model_config = {"from_attributes": True}


class PolicyClauseBase(BaseModel):
    id: str
    clause_code: str
    category: Optional[str] = None
    title: str
    description: Optional[str] = None
    max_hotel_rate: Optional[float] = None
    max_flight_discount: Optional[float] = None
    allowed_advance_days: Optional[int] = None


class PolicyClauseResponse(PolicyClauseBase):
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ExceptionRequestCreate(BaseModel):
    idempotency_key: str = Field(..., description="幂等键，防止重复提交")
    trip_id: str
    employee_id: str
    destination_id: Optional[str] = None
    exception_type: ExceptionType
    
    hotel_policy_clause_id: Optional[str] = None
    hotel_actual_rate: Optional[float] = None
    hotel_justification: Optional[str] = None
    
    flight_policy_clause_id: Optional[str] = None
    flight_actual_discount: Optional[float] = None
    flight_justification: Optional[str] = None
    
    combined_justification: Optional[str] = None
    
    @validator('hotel_justification')
    def validate_hotel_justification(cls, v, values):
        if values.get('exception_type') in [ExceptionType.HOTEL, ExceptionType.BOTH] and not v:
            if not values.get('combined_justification'):
                raise ValueError("酒店例外需要提供理由")
        return v
    
    @validator('flight_justification')
    def validate_flight_justification(cls, v, values):
        if values.get('exception_type') in [ExceptionType.FLIGHT, ExceptionType.BOTH] and not v:
            if not values.get('combined_justification'):
                raise ValueError("机票例外需要提供理由")
        return v


class ExceptionRequestResponse(BaseModel):
    id: str
    trip_id: str
    employee: EmployeeResponse
    destination: Optional[DestinationResponse] = None
    exception_type: ExceptionType
    status: ExceptionStatus
    
    hotel_policy: Optional[PolicyClauseResponse] = None
    hotel_actual_rate: Optional[float] = None
    hotel_justification: Optional[str] = None
    
    flight_policy: Optional[PolicyClauseResponse] = None
    flight_actual_discount: Optional[float] = None
    flight_justification: Optional[str] = None
    
    combined_justification: Optional[str] = None
    
    current_approver: Optional[EmployeeResponse] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ExceptionRequestListResponse(BaseModel):
    items: List[ExceptionRequestResponse]
    total: int
    page: int
    page_size: int


class ApprovalActionRequest(BaseModel):
    actor_id: str
    action: ApprovalAction
    comment: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    actor: EmployeeResponse
    action: ApprovalAction
    from_status: Optional[ExceptionStatus]
    to_status: ExceptionStatus
    comment: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ExceptionHistoryResponse(BaseModel):
    request_id: str
    logs: List[AuditLogResponse]


class ImportRowResult(BaseModel):
    row_number: int
    is_valid: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    error_field: Optional[str] = None
    suggestion: Optional[str] = None
    request_id: Optional[str] = None


class ImportBatchResponse(BaseModel):
    batch_id: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    results: List[ImportRowResult]


class ExportRow(BaseModel):
    request_id: str
    trip_id: str
    employee_id: str
    employee_name: str
    department: str
    destination: str
    exception_type: str
    status: str
    hotel_policy_breach: Optional[str] = None
    hotel_justification: Optional[str] = None
    flight_policy_breach: Optional[str] = None
    flight_justification: Optional[str] = None
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    final_decision: Optional[str] = None