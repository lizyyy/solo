from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class MaterialType(str, Enum):
    INVOICE = "发票"
    HOSPITAL_RECORD = "病历"
    DISCHARGE_SUMMARY = "出院小结"
    ID_CARD = "身份证"
    BANK_CARD = "银行卡"
    DIAGNOSIS = "诊断证明"
    EXPENSE_LIST = "费用清单"
    OTHER = "其他"


class ClaimStatus(str, Enum):
    PENDING = "待复核"
    APPROVED = "已通过"
    REJECTED = "已退回"
    SUPPLEMENT = "待补材料"


class IssueType(str, Enum):
    MISSING_INVOICE = "缺发票"
    AMOUNT_EXCEEDED = "金额超限"
    DUPLICATE_CLAIM = "重复报案"
    MISSING_MATERIAL = "缺材料"
    INVALID_MATERIAL = "材料无效"
    POLICY_EXPIRED = "保单过期"
    NOT_COVERED = "不在保障范围"
    CALCULATION_ERROR = "计算错误"


class ReviewAction(str, Enum):
    APPROVE = "通过"
    REJECT = "退回"
    REQUEST_SUPPLEMENT = "要求补材料"
    ADJUST_AMOUNT = "调整金额"


class Material(BaseModel):
    material_id: str
    material_type: MaterialType
    name: str
    upload_time: datetime
    file_url: Optional[str] = None
    is_valid: bool = True
    remarks: Optional[str] = None


class PolicyCoverage(BaseModel):
    coverage_type: str
    limit_amount: float
    used_amount: float = 0.0
    deductible: float = 0.0
    ratio: float = 1.0


class Policy(BaseModel):
    policy_id: str
    policy_number: str
    insured_name: str
    id_number: str
    effective_date: datetime
    expiry_date: datetime
    coverages: List[PolicyCoverage]
    total_limit: float
    remaining_limit: float


class ClaimItem(BaseModel):
    item_id: str
    expense_type: str
    expense_date: datetime
    invoice_number: Optional[str] = None
    invoice_amount: float
    claimed_amount: float
    approved_amount: Optional[float] = None
    hospital: Optional[str] = None
    diagnosis: Optional[str] = None


class ClaimApplication(BaseModel):
    claim_id: str
    claim_number: str
    policy_id: str
    applicant_name: str
    applicant_id: str
    claim_date: datetime
    materials: List[Material] = []
    claim_items: List[ClaimItem] = []
    total_claimed_amount: float = 0.0
    status: ClaimStatus = ClaimStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.now)


class IssueDetail(BaseModel):
    issue_type: IssueType
    severity: str = "warning"
    message: str
    evidence: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None


class ReconciliationResult(BaseModel):
    claim_id: str
    claim_number: str
    policy_number: str
    applicant_name: str
    status: ClaimStatus
    issues: List[IssueDetail] = []
    total_claimed_amount: float
    system_calculated_amount: float
    final_approved_amount: Optional[float] = None
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)


class ReviewRequest(BaseModel):
    claim_id: str
    action: ReviewAction
    reviewer: str
    notes: Optional[str] = None
    adjusted_amount: Optional[float] = None
    resolved_issues: List[str] = []


class ReconciliationSummary(BaseModel):
    total_claims: int = 0
    pending_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    supplement_count: int = 0
    total_claimed_amount: float = 0.0
    total_approved_amount: float = 0.0
    issue_distribution: Dict[str, int] = Field(default_factory=dict)
    issue_details: List[Dict[str, Any]] = Field(default_factory=list)
