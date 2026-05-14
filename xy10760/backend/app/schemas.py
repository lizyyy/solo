from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ApplicationBase(BaseModel):
    application_no: str
    applicant: str
    department: str
    application_type: str
    amount: int = 0
    extra_data: Dict[str, Any] = {}

class ApplicationCreate(ApplicationBase):
    pass

class Application(ApplicationBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

class RuleVersionBase(BaseModel):
    version: str
    name: str
    description: str = ""
    is_active: bool = False
    created_by: str

class RuleVersionCreate(RuleVersionBase):
    pass

class RuleVersion(RuleVersionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

class HitConditionBase(BaseModel):
    rule_version_id: int
    condition_type: str
    condition_expression: str
    condition_value: str
    operator: str
    priority: int = 0

class HitConditionCreate(HitConditionBase):
    pass

class HitCondition(HitConditionBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class ApproverBase(BaseModel):
    name: str
    email: str
    department: str
    level: int = 1
    is_active: bool = True

class ApproverCreate(ApproverBase):
    pass

class Approver(ApproverBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class SkipReasonBase(BaseModel):
    reason_code: str
    reason_text: str
    need_manual_confirm: bool = False

class SkipReasonCreate(SkipReasonBase):
    pass

class SkipReason(SkipReasonBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class ApproverError(BaseModel):
    approver_id: Optional[int]
    approver_name: str
    error_type: str
    error_message: str

class SimulationResultBase(BaseModel):
    application_id: int
    rule_version_id: int
    hit_condition_ids: List[int] = []
    approver_ids: List[int] = []
    approver_names: List[str] = []
    skip_reason_id: Optional[int] = None
    skip_reason_text: str = ""
    simulation_status: str = "success"
    error_details: str = ""
    approver_errors: List[ApproverError] = []
    final_approval_result: str = ""

class SimulationResultCreate(SimulationResultBase):
    idempotent_key: str
    created_by: str

class SimulationResult(SimulationResultBase):
    id: int
    idempotent_key: str
    skip_manual_confirmed: bool
    skip_confirmed_by: Optional[str]
    skip_confirmed_at: Optional[datetime]
    created_by: str
    created_at: datetime
    published: bool
    published_at: Optional[datetime]
    published_by: Optional[str]

    class Config:
        orm_mode = True

class SkipConfirmRequest(BaseModel):
    confirmed_by: str

class SimulationFilter(BaseModel):
    application_no: Optional[str] = None
    rule_version: Optional[str] = None
    simulation_status: Optional[str] = None
    published: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class SimulationDetailResponse(BaseModel):
    simulation: SimulationResult
    application: Application
    rule_version: RuleVersion
    hit_conditions: List[HitCondition]
    approvers: List[Approver]
    skip_reason: Optional[SkipReason]
