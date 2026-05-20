from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class BedTurnoverItem(BaseModel):
    department: str = Field(..., description="科室名称")
    bed_number: str = Field(..., description="床号")
    patient_id: str = Field(..., description="患者ID")
    patient_name: str = Field(..., description="患者姓名")
    admission_date: datetime = Field(..., description="入院日期")
    discharge_date: Optional[datetime] = Field(None, description="出院日期")
    diagnosis: Optional[str] = Field(None, description="诊断")
    surgeon: Optional[str] = Field(None, description="主治医生")

class BatchSubmitRequest(BaseModel):
    submitted_by: str = Field(..., description="提交人姓名")
    records: List[BedTurnoverItem] = Field(..., description="床位周转记录列表")
    remark: Optional[str] = Field(None, description="备注")

class BatchResponse(BaseModel):
    batch_id: str
    batch_hash: str
    submitted_by: str
    submitted_at: datetime
    status: str
    record_count: int
    is_duplicate: bool
    message: str

class BedTurnoverRecordResponse(BaseModel):
    id: int
    batch_id: str
    department: str
    bed_number: str
    patient_id: str
    patient_name: str
    admission_date: datetime
    discharge_date: Optional[datetime]
    admission_days: Optional[int]
    diagnosis: Optional[str]
    surgeon: Optional[str]
    is_effective: bool
    created_at: datetime

    class Config:
        from_attributes = True

class BatchDetailResponse(BaseModel):
    batch_id: str
    batch_hash: str
    submitted_by: str
    submitted_at: datetime
    status: str
    remark: Optional[str]
    records: List[BedTurnoverRecordResponse]

class UpdateRecordRequest(BaseModel):
    operator: str = Field(..., description="操作人姓名")
    reason: str = Field(..., description="修改原因")
    updates: Dict[str, Any] = Field(..., description="要更新的字段")

class AuditLogResponse(BaseModel):
    id: int
    batch_id: Optional[str]
    record_id: Optional[int]
    operator: str
    operation_type: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    reason: str
    operation_time: datetime

    class Config:
        from_attributes = True

class TraceabilityResponse(BaseModel):
    field_name: str
    original_value: Any
    current_value: Any
    change_history: List[Dict[str, Any]]

class ReportSummary(BaseModel):
    total_records: int
    effective_records: int
    total_departments: int
    avg_admission_days: float
    turnover_rate: float

class ReportResponse(BaseModel):
    batch_id: str
    generated_at: datetime
    summary: ReportSummary
    department_statistics: List[Dict[str, Any]]
