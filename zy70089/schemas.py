from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from models import PollutantType, DetectionStatus, OverlimitStatus, RectificationStatus


class PermissionBase(BaseModel):
    permit_no: str = Field(..., max_length=64, description="许可证编号")
    enterprise_name: str = Field(..., max_length=255, description="企业名称")
    pollutant_type: PollutantType
    pollutant_name: str = Field(..., max_length=128, description="污染物名称")
    limit_value: float = Field(..., gt=0, description="许可限值")
    limit_unit: str = Field(..., max_length=32, description="单位")
    effective_date: date = Field(..., description="生效日期")
    expiry_date: date = Field(..., description="到期日期")


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    enterprise_name: Optional[str] = None
    pollutant_type: Optional[PollutantType] = None
    pollutant_name: Optional[str] = None
    limit_value: Optional[float] = None
    limit_unit: Optional[str] = None
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DetectionReportBase(BaseModel):
    report_no: str = Field(..., max_length=64, description="检测报告编号")
    permit_no: str = Field(..., max_length=64, description="关联许可证编号")
    detection_date: datetime = Field(..., description="检测时间")
    detection_value: float = Field(..., description="检测值")
    detection_unit: str = Field(..., max_length=32, description="检测单位")
    detection_method: Optional[str] = None
    lab_name: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class DetectionReportCreate(DetectionReportBase):
    pass


class DetectionReportResponse(DetectionReportBase):
    id: int
    permission_id: int
    status: DetectionStatus
    is_overlimit: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DetectionReportImportItem(BaseModel):
    report_no: str
    permit_no: str
    detection_date: datetime
    detection_value: float
    detection_unit: str
    detection_method: Optional[str] = None
    lab_name: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class OverlimitRecordResponse(BaseModel):
    id: int
    permission_id: int
    detection_report_id: int
    overlimit_value: float
    overlimit_ratio: float
    detection_date: datetime
    identification_date: datetime
    status: OverlimitStatus
    description: Optional[str] = None
    enterprise_name: Optional[str] = None
    pollutant_name: Optional[str] = None
    permit_no: Optional[str] = None

    class Config:
        from_attributes = True


class RectificationTaskBase(BaseModel):
    overlimit_record_id: int = Field(..., description="关联超标记录ID")
    deadline: datetime = Field(..., description="整改截止期限")
    rectification_measures: Optional[str] = None
    responsible_person: Optional[str] = None
    contact_info: Optional[str] = None
    remark: Optional[str] = None


class RectificationTaskCreate(RectificationTaskBase):
    pass


class RectificationTaskUpdate(BaseModel):
    deadline: Optional[datetime] = None
    rectification_measures: Optional[str] = None
    responsible_person: Optional[str] = None
    contact_info: Optional[str] = None
    actual_completion_date: Optional[datetime] = None
    status: Optional[RectificationStatus] = None
    remark: Optional[str] = None


class RectificationTaskResponse(BaseModel):
    id: int
    overlimit_record_id: int
    task_no: str
    deadline: datetime
    actual_completion_date: Optional[datetime] = None
    rectification_measures: Optional[str] = None
    responsible_person: Optional[str] = None
    contact_info: Optional[str] = None
    status: RectificationStatus
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    overlimit_info: Optional[dict] = None

    class Config:
        from_attributes = True


class ReviewReceiptBase(BaseModel):
    rectification_task_id: int = Field(..., description="关联整改任务ID")
    review_date: datetime = Field(..., description="复查时间")
    reviewer: Optional[str] = None
    review_organization: Optional[str] = None
    review_result: bool = Field(False, description="复查是否通过")
    review_comment: Optional[str] = None
    redetection_value: Optional[float] = None
    redetection_unit: Optional[str] = None
    is_qualified: Optional[bool] = False


class ReviewReceiptCreate(ReviewReceiptBase):
    pass


class ReviewReceiptResponse(ReviewReceiptBase):
    id: int
    receipt_no: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupervisionReportBase(BaseModel):
    rectification_task_id: int = Field(..., description="关联整改任务ID")
    report_date: datetime = Field(default_factory=datetime.utcnow)
    reporter: Optional[str] = None
    report_organization: Optional[str] = None
    supervision_content: Optional[str] = None
    supervision_result: Optional[str] = None
    suggestion: Optional[str] = None


class SupervisionReportCreate(SupervisionReportBase):
    pass


class SupervisionReportResponse(SupervisionReportBase):
    id: int
    report_no: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    total: int
    success: int
    failed: int
    failed_records: List[dict] = []
    overlimit_count: int = 0


class TraceRecord(BaseModel):
    type: str
    id: int
    no: Optional[str] = None
    date: datetime
    status: str
    detail: str


class FullTraceResponse(BaseModel):
    permission: Optional[PermissionResponse] = None
    detection_reports: List[DetectionReportResponse] = []
    overlimit_records: List[OverlimitRecordResponse] = []
    rectification_tasks: List[RectificationTaskResponse] = []
    review_receipts: List[ReviewReceiptResponse] = []
    supervision_reports: List[SupervisionReportResponse] = []
    timeline: List[TraceRecord] = []
