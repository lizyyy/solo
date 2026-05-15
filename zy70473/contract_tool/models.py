from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class ContractStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    CONFLICT = "conflict"


class FailureType(str, Enum):
    TIME_ORDER_ERROR = "time_order_error"
    DUPLICATE_SUBMISSION = "duplicate_submission"
    DATA_INCOMPLETE = "data_incomplete"
    VALIDATION_ERROR = "validation_error"


class OfflineContractSupplement(BaseModel):
    contract_id: str = Field(description="合同ID")
    supplement_id: str = Field(description="补充页ID")
    supplement_type: str = Field(description="补充页类型")
    content: str = Field(description="补充内容")
    create_time: datetime = Field(description="创建时间")
    operator: str = Field(description="操作人")


class PaymentReceipt(BaseModel):
    receipt_id: str = Field(description="回执ID")
    contract_id: str = Field(description="关联合同ID")
    payment_channel: str = Field(description="支付渠道")
    amount: float = Field(description="金额")
    payment_time: datetime = Field(description="支付时间")
    manual_remark: Optional[str] = Field(None, description="人工备注")
    caller: str = Field(description="调用方标识")
    create_time: datetime = Field(default_factory=datetime.now)


class ContractSubmission(BaseModel):
    batch_id: str = Field(description="批次ID")
    contract_id: str = Field(description="合同ID")
    contract_name: str = Field(description="合同名称")
    party_a: str = Field(description="甲方")
    party_b: str = Field(description="乙方")
    sign_time_a: datetime = Field(description="甲方签署时间")
    sign_time_b: datetime = Field(description="乙方签署时间")
    create_time: datetime = Field(description="合同创建时间")
    supplements: List[OfflineContractSupplement] = Field(default_factory=list, description="离线合同补充页")
    payment_receipts: List[PaymentReceipt] = Field(default_factory=list, description="支付回执")
    submit_time: datetime = Field(default_factory=datetime.now)
    submitter: str = Field(description="提交人")

    @validator('sign_time_b')
    def check_time_order(cls, v, values):
        if 'sign_time_a' in values and v < values['sign_time_a']:
            raise ValueError(f"乙方签署时间({v})早于甲方签署时间({values['sign_time_a']})")
        return v


class ProcessingResult(BaseModel):
    batch_id: str
    contract_id: str
    status: ContractStatus
    failure_type: Optional[FailureType] = None
    error_message: Optional[str] = None
    is_reused: bool = False
    original_batch_id: Optional[str] = None
    process_time: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any] = Field(default_factory=dict)


class LogSamplingConfig(BaseModel):
    enabled: bool = True
    sample_rate: float = Field(1.0, ge=0.0, le=1.0, description="采样率 0-1")
    failure_sample_rate: float = Field(1.0, ge=0.0, le=1.0, description="失败项采样率")
    export_abnormal_samples: bool = Field(True, description="是否导出异常样本")
    abnormal_export_path: str = Field("output/abnormal_samples", description="异常样本导出路径")


class FailureRecord(BaseModel):
    batch_id: str
    contract_id: str
    failure_type: FailureType
    error_message: str
    submission_data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)
    reviewer: Optional[str] = None
    review_status: str = "pending"
