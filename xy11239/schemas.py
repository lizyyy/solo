from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ReagentBase(BaseModel):
    name: str
    cas_no: Optional[str] = None
    specification: Optional[str] = None
    danger_level: str
    unit: str
    description: Optional[str] = None


class ReagentCreate(ReagentBase):
    operator: str
    operator_role: str


class Reagent(ReagentBase):
    id: int
    created_at: datetime
    created_by: str
    is_active: bool

    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    reagent_id: int
    quantity: float
    location: Optional[str] = None
    batch_no: Optional[str] = None
    expired_at: Optional[datetime] = None


class InventoryCreate(InventoryBase):
    operator: str
    operator_role: str


class Inventory(InventoryBase):
    id: int
    updated_at: datetime
    updated_by: str

    class Config:
        from_attributes = True


class ApplicationBase(BaseModel):
    reagent_id: int
    quantity: float
    purpose: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    applicant: str
    applicant_role: str


class ApplicationResubmit(BaseModel):
    applicant: str
    applicant_role: str
    purpose: Optional[str] = None


class ApprovalBase(BaseModel):
    application_id: int
    approver: str
    approver_role: str
    decision: str
    comment: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    pass


class Approval(ApprovalBase):
    id: int
    approval_index: int
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True


class Application(ApplicationBase):
    id: int
    application_no: str
    applicant: str
    applicant_role: str
    status: str
    current_approval_index: int
    required_approvals: int
    created_at: datetime
    updated_at: datetime
    approvals: List[Approval] = []

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    application_id: Optional[int] = None
    reagent_id: Optional[int] = None
    operator: str
    operator_role: str
    quantity: Optional[float] = None
    result: str
    reason: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StockOut(BaseModel):
    application_id: int
    operator: str
    operator_role: str


class StockReturn(BaseModel):
    reagent_id: int
    quantity: float
    operator: str
    operator_role: str
    reason: Optional[str] = None


class InventoryCheck(BaseModel):
    reagent_id: int
    actual_quantity: float
    operator: str
    operator_role: str
    remark: Optional[str] = None
