from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict
from enum import Enum


class SubsidyLevel(str, Enum):
    LEVEL_A = "A"
    LEVEL_B = "B"
    LEVEL_C = "C"


class VerificationStatus(str, Enum):
    PENDING = "待核验"
    VERIFIED = "已通过"
    REJECTED = "已驳回"
    SUPPLEMENT = "需补材料"
    WITHDRAWN = "已撤回"


class CertificateStatus(str, Enum):
    VALID = "有效"
    USED = "已使用"
    EXPIRED = "已过期"
    CANCELLED = "已作废"


class MealVoucherBase(BaseModel):
    voucher_no: str = Field(..., description="助餐券编号")
    id_card: str = Field(..., description="身份证号")
    name: str = Field(..., description="姓名")
    phone: str = Field(..., description="联系电话")
    address: str = Field(..., description="居住地址")
    community: str = Field(..., description="所属社区")
    subsidy_level: SubsidyLevel = Field(..., description="补贴等级")
    subsidy_amount: float = Field(..., description="补贴金额")
    issue_date: date = Field(..., description="发放日期")
    expire_date: date = Field(..., description="有效期至")
    dining_point: str = Field(..., description="助餐点名称")
    dining_point_code: str = Field(..., description="助餐点编号")
    applicant_type: str = Field(..., description="申请人类型")
    family_status: str = Field(..., description="家庭状况")
    income_level: str = Field(..., description="收入水平")
    disability_type: Optional[str] = Field(None, description="残疾类型")
    disability_level: Optional[str] = Field(None, description="残疾等级")
    elderly_age: Optional[int] = Field(None, description="老年人年龄")
    low_income_cert: Optional[bool] = Field(None, description="低保证明")
    low_income_cert_no: Optional[str] = Field(None, description="低保证编号")
    disability_cert: Optional[bool] = Field(None, description="残疾证明")
    disability_cert_no: Optional[str] = Field(None, description="残疾证编号")
    elderly_cert: Optional[bool] = Field(None, description="老年证")
    elderly_cert_no: Optional[str] = Field(None, description="老年证编号")
    household_registry: Optional[bool] = Field(None, description="户口本")
    income_proof: Optional[bool] = Field(None, description="收入证明")


class MealVoucherCreate(MealVoucherBase):
    operator: str = Field(..., description="操作人")
    operation_time: datetime = Field(default_factory=datetime.now, description="操作时间")
    remark: Optional[str] = Field(None, description="备注")


class MealVoucher(MealVoucherBase):
    id: int
    verification_status: VerificationStatus
    certificate_status: CertificateStatus
    verification_time: Optional[datetime]
    verifier: Optional[str]
    verification_remark: Optional[str]
    subsidy_level_history: List[SubsidyLevel]
    created_at: datetime
    updated_at: datetime
    operator: str
    remark: Optional[str]

    class Config:
        from_attributes = True


class VerificationRequest(BaseModel):
    voucher_no: str
    verifier: str
    verification_remark: Optional[str] = None


class BatchImportResult(BaseModel):
    total: int
    success: int
    failed: int
    errors: List[Dict[str, str]]
    warnings: List[Dict[str, str]]


class VerificationResult(BaseModel):
    voucher_no: str
    id_card: str
    name: str
    status: VerificationStatus
    certificate_status: CertificateStatus
    subsidy_level: SubsidyLevel
    original_subsidy_level: Optional[SubsidyLevel]
    required_materials: List[str]
    verification_remark: Optional[str]
    monthly_report_consistent: bool
    old_voucher_usable: bool


class ExportRequest(BaseModel):
    status_filter: Optional[List[VerificationStatus]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    dining_point_code: Optional[str] = None
    subsidy_level: Optional[SubsidyLevel] = None
