from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class RawMaterialCreate(BaseModel):
    batch_number: str = Field(..., description="器械包批号")
    sterilization_cycle: str = Field(..., description="消毒炉次")
    operating_room: str = Field(..., description="手术间")
    receiving_nurse: str = Field(..., description="领用护士")
    isolation_reason: str = Field(..., description="隔离原因")
    submission_time: datetime = Field(..., description="提交时间")
    surgery_time: datetime = Field(..., description="手术时间")
    supplementary_info: Optional[str] = Field(None, description="补充说明")


class DecisionCreate(BaseModel):
    isolation_order_id: int = Field(..., description="隔离单ID")
    decision_type: str = Field(..., description="判定类型：approve/reject/supplement")
    conclusion: str = Field(..., description="结论")
    reason: str = Field(..., description="原因")
    operator: str = Field(..., description="操作人")
    supplementary_evidence: Optional[str] = Field(None, description="补充证据")


class IsolationOrderResponse(BaseModel):
    id: int
    order_no: str
    batch_number: str
    sterilization_cycle: str
    operating_room: str
    receiving_nurse: str
    isolation_reason: str
    submission_time: datetime
    surgery_time: datetime
    is_late_submission: bool
    cross_room_usage: bool
    temp_package_change: bool
    status: str
    final_conclusion: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DecisionRecordResponse(BaseModel):
    id: int
    isolation_order_id: int
    decision_type: str
    conclusion: str
    reason: str
    operator: str
    supplementary_evidence: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class IsolationOrderDetailResponse(IsolationOrderResponse):
    decisions: List[DecisionRecordResponse]


class ValidationResult(BaseModel):
    is_valid: bool
    issues: List[str]
    risk_level: str


class ExportResponse(BaseModel):
    total_count: int
    exported_count: int
    csv_content: str
