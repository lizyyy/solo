from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class ReductionApplicationBase(BaseModel):
    application_no: str = Field(..., max_length=50)
    contract_id: int = Field(...)
    tenant_name: str = Field(..., max_length=100)
    store_code: Optional[str] = Field(default=None, max_length=50)
    reduction_reason: str = Field(..., max_length=200)
    reduction_type: str = Field(default="租金减免", max_length=50)
    closure_start_date: date = Field(...)
    closure_end_date: date = Field(...)
    applied_days: int = Field(..., ge=1)
    approved_days: Optional[int] = Field(default=None, ge=0)
    reduction_start_date: Optional[date] = None
    reduction_end_date: Optional[date] = None
    reduction_ratio: Decimal = Field(default=Decimal("1.0"), max_digits=5, decimal_places=4)
    monthly_rent_standard: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=2)
    monthly_service_fee_standard: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    review_comments: Optional[str] = None
    approval_comments: Optional[str] = None
    remarks: Optional[str] = None


class ReductionApplicationCreate(ReductionApplicationBase):
    pass


class ReductionApplicationUpdate(BaseModel):
    reduction_reason: Optional[str] = None
    reduction_type: Optional[str] = None
    closure_start_date: Optional[date] = None
    closure_end_date: Optional[date] = None
    applied_days: Optional[int] = None
    approved_days: Optional[int] = None
    reduction_start_date: Optional[date] = None
    reduction_end_date: Optional[date] = None
    reduction_ratio: Optional[Decimal] = None
    monthly_rent_standard: Optional[Decimal] = None
    monthly_service_fee_standard: Optional[Decimal] = None
    review_comments: Optional[str] = None
    approval_comments: Optional[str] = None
    manual_override_reason: Optional[str] = None
    remarks: Optional[str] = None


class ReductionApplicationInfo(ReductionApplicationBase):
    id: int
    calculated_rent_reduction: Decimal
    calculated_service_fee_reduction: Decimal
    total_reduction_amount: Decimal
    has_anomaly: bool
    anomaly_description: Optional[str]
    status: str
    current_step: str
    trial_calc_result: Optional[str]
    manual_override: bool
    manual_override_reason: Optional[str]
    manual_override_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReductionTrialCalcRequest(BaseModel):
    application_id: int
    operator: str = Field(default="system")


class ReductionTrialCalcResult(BaseModel):
    application_id: int
    application_no: str
    tenant_name: str
    daily_rent: Decimal
    daily_service_fee: Decimal
    applied_days: int
    actual_reduction_days: int
    rent_reduction: Decimal
    service_fee_reduction: Decimal
    total_reduction: Decimal
    reduction_ratio: Decimal
    calculation_details: str
    anomalies: List[dict] = Field(default_factory=list)
    contract_version_valid: bool
    contract_version_info: Optional[str] = None


class AnomalyFlagInfo(BaseModel):
    id: int
    application_id: int
    anomaly_type: str
    severity: str
    status: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    expected_value: Optional[str]
    description: str
    detected_by: str
    detected_at: Optional[date]
    resolved_by: Optional[str]
    resolved_at: Optional[date]
    resolution: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class AnomalyResolveRequest(BaseModel):
    resolution: str = Field(..., description="解决方式说明")
    resolved_by: str = Field(..., description="处理人")
    new_value: Optional[str] = None
    status: str = Field(default="已解决")


class StoreClosureProofBase(BaseModel):
    application_id: int
    proof_no: Optional[str] = None
    closure_reason: Optional[str] = None
    actual_closure_date: Optional[date] = None
    actual_reopen_date: Optional[date] = None
    actual_closure_days: Optional[int] = None
    supporting_docs: Optional[str] = None
    verified_by: Optional[str] = None
    verification_date: Optional[date] = None
    verification_status: str = Field(default="未核实")
    remarks: Optional[str] = None


class StoreClosureProofCreate(StoreClosureProofBase):
    pass


class StoreClosureProofUpdate(BaseModel):
    proof_no: Optional[str] = None
    closure_reason: Optional[str] = None
    actual_closure_date: Optional[date] = None
    actual_reopen_date: Optional[date] = None
    actual_closure_days: Optional[int] = None
    supporting_docs: Optional[str] = None
    verified_by: Optional[str] = None
    verification_date: Optional[date] = None
    verification_status: Optional[str] = None
    remarks: Optional[str] = None


class StoreClosureProofInfo(StoreClosureProofBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplementaryAgreementBase(BaseModel):
    agreement_no: str
    contract_id: int
    application_id: Optional[int] = None
    version: int = Field(default=1)
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    reduction_amount: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    reduction_days: Optional[int] = None
    payment_method: Optional[str] = None
    signed_by_party_a: Optional[str] = None
    signed_by_party_b: Optional[str] = None
    status: str = Field(default="草稿")
    remarks: Optional[str] = None


class SupplementaryAgreementCreate(SupplementaryAgreementBase):
    pass


class SupplementaryAgreementUpdate(BaseModel):
    version: Optional[int] = None
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    reduction_amount: Optional[Decimal] = None
    reduction_days: Optional[int] = None
    payment_method: Optional[str] = None
    signed_by_party_a: Optional[str] = None
    signed_by_party_b: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class SupplementaryAgreementInfo(SupplementaryAgreementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
