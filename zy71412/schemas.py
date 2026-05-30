from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional


class MaterialBase(BaseModel):
    material_type: str
    file_name: str
    uploaded_by: str
    source: Optional[str] = None
    remark: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: int
    file_hash: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class CollateralBase(BaseModel):
    collateral_no: str
    name: str
    collateral_type: Optional[str] = None
    address: Optional[str] = None
    owner: Optional[str] = None
    id_card: Optional[str] = None


class CollateralCreate(CollateralBase):
    pass


class CollateralResponse(CollateralBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CollateralVersionBase(BaseModel):
    collateral_id: int
    appraised_value: float
    appraisal_date: date
    appraisal_expiry_date: date
    mortgage_rate: float
    material_id: Optional[int] = None
    appraiser: Optional[str] = None
    appraisal_report_no: Optional[str] = None
    remark: Optional[str] = None


class CollateralVersionCreate(CollateralVersionBase):
    pass


class CollateralVersionResponse(CollateralVersionBase):
    id: int
    version_no: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreditContractBase(BaseModel):
    contract_no: str
    borrower: str
    borrower_id_card: Optional[str] = None
    credit_amount: float
    start_date: date
    end_date: date
    bank: Optional[str] = None
    account_manager: Optional[str] = None
    material_id: Optional[int] = None
    remark: Optional[str] = None


class CreditContractCreate(CreditContractBase):
    pass


class CreditContractResponse(CreditContractBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CreditOccupancyBase(BaseModel):
    contract_id: int
    collateral_id: int
    collateral_version_id: int
    occupancy_amount: float
    occupancy_date: date
    remark: Optional[str] = None


class CreditOccupancyCreate(CreditOccupancyBase):
    pass


class CreditOccupancyResponse(CreditOccupancyBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReassessmentCreate(BaseModel):
    name: str
    collateral_ids: List[int]
    triggered_by: Optional[str] = None
    max_rate: float = 0.7


class ReassessmentTaskResponse(BaseModel):
    id: int
    collateral_id: int
    status: str
    current_mortgage_rate: Optional[float] = None
    max_allowed_rate: float
    calculated_balance: Optional[float] = None
    latest_appraised_value: Optional[float] = None
    remark: Optional[str] = None
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReassessmentResponse(BaseModel):
    id: int
    reassessment_no: str
    name: str
    status: str
    triggered_by: Optional[str] = None
    handler: Optional[str] = None
    reviewer: Optional[str] = None
    review_opinion: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    review_at: Optional[datetime] = None
    tasks: List[ReassessmentTaskResponse] = []

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    reviewer: str
    review_opinion: Optional[str] = None
    approve: bool = True


class WarningResponse(BaseModel):
    id: int
    warning_type: str
    severity: str
    message: str
    blocked_at: Optional[str] = None
    next_action: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    material_id: Optional[int] = None
    collateral_id: Optional[int] = None
    collateral_version_id: Optional[int] = None
    contract_id: Optional[int] = None
    trigger_material: Optional[str] = None

    class Config:
        from_attributes = True


class CollateralImportRequest(BaseModel):
    collateral_no: str
    name: str
    collateral_type: Optional[str] = None
    address: Optional[str] = None
    owner: Optional[str] = None
    id_card: Optional[str] = None
    appraised_value: float
    appraisal_date: date
    appraisal_expiry_date: date
    mortgage_rate: float
    appraiser: Optional[str] = None
    appraisal_report_no: Optional[str] = None
    file_name: Optional[str] = None
    uploaded_by: str
    source: Optional[str] = None


class ContractImportRequest(BaseModel):
    contract_no: str
    borrower: str
    borrower_id_card: Optional[str] = None
    credit_amount: float
    start_date: date
    end_date: date
    bank: Optional[str] = None
    account_manager: Optional[str] = None
    file_name: Optional[str] = None
    uploaded_by: str
    source: Optional[str] = None
    collateral_no: str
    occupancy_amount: float
    occupancy_date: date
