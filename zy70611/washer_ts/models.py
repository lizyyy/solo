from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class MachineStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    FAULT = "fault"
    MAINTENANCE = "maintenance"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDING = "refunding"
    REFUNDED = "refunded"
    PARTIAL_REFUNDED = "partial_refunded"


class StartEventStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class RefundStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


class FaultCode(str, Enum):
    E001 = "E001"
    E002 = "E002"
    E003 = "E003"
    E004 = "E004"
    E005 = "E005"
    UNKNOWN = "UNKNOWN"


FAULT_DESCRIPTIONS = {
    FaultCode.E001: "电机故障 - 电机无法启动或转速异常",
    FaultCode.E002: "进水故障 - 进水超时或水压不足",
    FaultCode.E003: "排水故障 - 排水泵堵塞或超时",
    FaultCode.E004: "门锁故障 - 门锁无法锁定或解锁",
    FaultCode.E005: "温度传感器故障 - 温度读取异常",
    FaultCode.UNKNOWN: "未知故障 - 故障代码未识别",
}


class Machine(BaseModel):
    machine_id: str = Field(..., description="机器编号")
    location: str = Field(..., description="机器位置")
    status: MachineStatus = Field(default=MachineStatus.IDLE)
    last_fault_code: Optional[FaultCode] = None
    last_maintenance: Optional[datetime] = None

    class Config:
        use_enum_values = True


class PaymentRecord(BaseModel):
    payment_id: str = Field(..., description="支付流水号")
    machine_id: str = Field(..., description="机器编号")
    user_id: str = Field(..., description="用户ID")
    amount: float = Field(..., gt=0, description="支付金额")
    status: PaymentStatus
    pay_time: Optional[datetime] = None
    transaction_id: Optional[str] = None

    @validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("金额必须大于0")
        return round(v, 2)

    class Config:
        use_enum_values = True


class StartEvent(BaseModel):
    event_id: str = Field(..., description="启动事件ID")
    machine_id: str = Field(..., description="机器编号")
    payment_id: Optional[str] = None
    user_id: Optional[str] = None
    status: StartEventStatus
    fault_code: Optional[FaultCode] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        use_enum_values = True


class RefundApplication(BaseModel):
    refund_id: str = Field(..., description="退款申请ID")
    payment_id: str = Field(..., description="关联支付流水号")
    machine_id: str = Field(..., description="机器编号")
    user_id: str = Field(..., description="用户ID")
    refund_amount: float = Field(..., gt=0, description="退款金额")
    reason: str = Field(..., description="退款原因")
    status: RefundStatus = RefundStatus.PENDING
    fault_code: Optional[FaultCode] = None
    apply_time: datetime
    process_time: Optional[datetime] = None
    operator: Optional[str] = None
    reject_reason: Optional[str] = None

    @validator("refund_amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("退款金额必须大于0")
        return round(v, 2)

    class Config:
        use_enum_values = True


class VerificationResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    PENDING = "pending"


class ConclusionStatus(str, Enum):
    APPROVE_REFUND = "approve_refund"
    REJECT_REFUND = "reject_refund"
    NEED_MORE_INFO = "need_more_info"
    PARTIAL_REFUND = "partial_refund"


class TroubleshootingResult(BaseModel):
    case_id: str
    machine_id: str
    payment_id: Optional[str] = None
    refund_id: Optional[str] = None

    payment_verification: VerificationResult
    payment_verification_details: dict = Field(default_factory=dict)

    event_matching: VerificationResult
    event_matching_details: dict = Field(default_factory=dict)

    refund_state_check: VerificationResult
    refund_state_details: dict = Field(default_factory=dict)

    idempotency_check: VerificationResult
    idempotency_details: dict = Field(default_factory=dict)

    fault_analysis: dict = Field(default_factory=dict)
    conclusion: ConclusionStatus
    conclusion_reason: str
    suggested_refund_amount: Optional[float] = None

    generated_at: datetime = Field(default_factory=datetime.now)
    related_records: dict = Field(default_factory=dict)

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat()}
