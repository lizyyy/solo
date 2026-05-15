from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Generic, TypeVar
from datetime import datetime
from models import RiskType, OperationType, SourceSystem

T = TypeVar('T')


class RuleVersionBase(BaseModel):
    version: str
    rule_content: Dict[str, Any]
    description: Optional[str] = None
    effective_time: datetime
    expire_time: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None


class RuleVersionCreate(RuleVersionBase):
    pass


class RuleVersion(RuleVersionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderBase(BaseModel):
    order_no: str
    batch_no: Optional[str] = None
    source_system: Optional[str] = SourceSystem.CUSTOMER_SERVICE
    source_order_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    service_type: Optional[str] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    original_input: Dict[str, Any]
    created_by: Optional[str] = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderJudge(BaseModel):
    manual_judgment: str
    judgment_remark: Optional[str] = None
    judged_by: str


class WorkOrder(WorkOrderBase):
    id: int
    risk_type: Optional[str] = None
    risk_score: Optional[float] = None
    is_abnormal: bool = False
    timezone_offset: Optional[int] = None
    timezone_abnormal: bool = False
    system_judgment: Optional[str] = None
    manual_judgment: Optional[str] = None
    judgment_remark: Optional[str] = None
    final_judgment: Optional[str] = None
    judged_by: Optional[str] = None
    judged_at: Optional[datetime] = None
    rule_version_id: Optional[int] = None
    rule_snapshot: Optional[Dict[str, Any]] = None
    status: str = "pending"
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkOrderDetail(WorkOrder):
    rule_version: Optional[RuleVersion] = None


class OperationLogBase(BaseModel):
    work_order_id: Optional[int] = None
    batch_no: Optional[str] = None
    operation_type: str
    operator: str
    operation_remark: Optional[str] = None
    before_data: Optional[Dict[str, Any]] = None
    after_data: Optional[Dict[str, Any]] = None
    source_system: Optional[str] = None
    change_reason: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CleanCandidateBase(BaseModel):
    batch_no: str
    candidate_ids: List[int]
    filters: Optional[Dict[str, Any]] = None
    total_count: int
    generated_by: str


class CleanCandidateCreate(CleanCandidateBase):
    pass


class CleanCandidate(CleanCandidateBase):
    id: int
    is_executed: bool = False
    executed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderQuery(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[str] = None
    source_system: Optional[str] = None
    status: Optional[str] = None
    is_abnormal: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel, Generic[T]):
    total: int
    page: int
    page_size: int
    items: List[T]

    class Config:
        from_attributes = True


class WorkOrderPaginatedResponse(PaginatedResponse[WorkOrder]):
    pass


class OperationLogPaginatedResponse(PaginatedResponse[OperationLog]):
    pass
