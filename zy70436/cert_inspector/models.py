from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class RiskType(str, Enum):
    EXPIRED = "已过期"
    EXPIRING_SOON = "即将过期"
    BATCH_CONFLICT = "批次号冲突"
    DATA_INCOMPLETE = "数据不全"
    NORMAL = "正常"


class DataSource(str, Enum):
    FINANCE = "财务系统"
    TAX = "税务系统"
    ERP = "ERP系统"
    CRM = "CRM系统"
    SUPPLY_CHAIN = "供应链系统"


class CertificateStatus(str, Enum):
    VALID = "有效"
    EXPIRED = "已过期"
    REVOKED = "已吊销"
    PENDING = "待审核"


class LakePartitionInfo(BaseModel):
    partition_id: str = Field(description="分区ID")
    data_source: DataSource = Field(description="数据来源")
    batch_no: str = Field(description="批次号")
    department: str = Field(description="提交部门")
    submitter: str = Field(description="提交人")
    submit_date: date = Field(description="提交日期")
    cert_count: int = Field(description="证书数量", ge=0)
    data_date: date = Field(description="数据日期")
    environment: str = Field(description="环境名称")


class Certificate(BaseModel):
    cert_id: str = Field(description="证书ID")
    cert_no: str = Field(description="证书编号")
    cert_type: str = Field(description="证书类型")
    holder: str = Field(description="持证人")
    issue_date: date = Field(description="签发日期")
    expiry_date: date = Field(description="到期日期")
    issuer: str = Field(description="签发机构")
    status: CertificateStatus = Field(description="证书状态")
    data_source: DataSource = Field(description="数据来源")
    batch_no: str = Field(description="批次号")
    department: str = Field(description="所属部门")
    invoice_redemption_ref: Optional[str] = Field(None, description="发票红冲参考号")
    original_input_ref: Optional[str] = Field(None, description="原始输入参考")
    processing_basis: Optional[str] = Field(None, description="处理依据")

    @property
    def days_until_expiry(self) -> int:
        return (self.expiry_date - date.today()).days

    @property
    def risk_level(self) -> RiskType:
        if self.days_until_expiry < 0:
            return RiskType.EXPIRED
        elif self.days_until_expiry <= 30:
            return RiskType.EXPIRING_SOON
        return RiskType.NORMAL


class InspectionResult(BaseModel):
    batch_id: str = Field(description="巡检批次ID")
    inspector: str = Field(description="巡检人")
    inspection_time: datetime = Field(default_factory=datetime.now)
    total_certs: int = Field(description="证书总数")
    expired_count: int = Field(description="已过期数量")
    expiring_soon_count: int = Field(description="即将过期数量")
    batch_conflicts: List[Dict[str, Any]] = Field(default_factory=list, description="批次号冲突列表")
    risk_details: List[Dict[str, Any]] = Field(default_factory=list, description="风险详情")
    manual_corrections: List[Dict[str, Any]] = Field(default_factory=list, description="人工修正记录")


class ManualCorrection(BaseModel):
    correction_id: str = Field(description="修正ID")
    cert_id: str = Field(description="证书ID")
    original_risk: RiskType = Field(description="原始风险类型")
    corrected_risk: RiskType = Field(description="修正后风险类型")
    operator: str = Field(description="操作者")
    operation_time: datetime = Field(default_factory=datetime.now)
    remark: str = Field(description="修正备注")
    batch_id: str = Field(description="所属巡检批次")


class InvoiceRedemptionRecord(BaseModel):
    record_id: str = Field(description="记录ID")
    invoice_no: str = Field(description="发票号码")
    redemption_date: date = Field(description="红冲日期")
    amount: float = Field(description="红冲金额")
    operator: str = Field(description="操作人")
    department: str = Field(description="所属部门")
    environment: str = Field(description="环境名称")
    original_input: Dict[str, Any] = Field(description="原始输入数据")
    processing_basis: str = Field(description="处理依据")
    related_cert_ids: List[str] = Field(default_factory=list, description="关联证书ID列表")
    batch_no: str = Field(description="批次号")
