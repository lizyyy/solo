from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class NodeType(str, Enum):
    HYDROELECTRIC = "水电"
    TILEWORK = "泥木"
    PAINTING = "油漆"
    FINAL_INSPECTION = "竣工验收"
    OTHER = "其他"


class PhotoStatus(str, Enum):
    COMPLETE = "complete"
    MISSING = "missing"
    PARTIAL = "partial"
    UNKNOWN = "unknown"


class FinalStatus(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_MATERIAL = "need_material"
    PENDING = "pending"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_MATERIAL = "request_material"
    ADJUST_FINE = "adjust_fine"
    UPDATE_EXPLANATION = "update_explanation"


class ProjectBase(BaseModel):
    project_name: str = Field(..., description="工程名称")
    project_address: Optional[str] = Field(None, description="工程地址")
    customer_name: Optional[str] = Field(None, description="业主姓名")
    total_amount: Optional[float] = Field(0, description="工程总金额")


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConstructionNodeBase(BaseModel):
    node_code: str = Field(..., description="节点编码")
    node_name: str = Field(..., description="节点名称")
    node_type: Optional[str] = Field(None, description="节点类型")
    planned_date: Optional[datetime] = Field(None, description="计划完成日期")
    actual_date: Optional[datetime] = Field(None, description="实际完成日期")
    node_amount: Optional[float] = Field(0, description="节点金额")
    required_photos: Optional[int] = Field(0, description="要求照片数量")
    status: Optional[str] = Field("pending", description="节点状态")


class ConstructionNodeCreate(ConstructionNodeBase):
    project_id: int


class ConstructionNodeResponse(ConstructionNodeBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PhotoRecordBase(BaseModel):
    photo_id: Optional[str] = Field(None, description="照片ID")
    photo_name: Optional[str] = Field(None, description="照片名称")
    photo_url: Optional[str] = Field(None, description="照片URL")
    upload_time: Optional[datetime] = Field(None, description="上传时间")
    photo_type: Optional[str] = Field(None, description="照片类型")
    uploader: Optional[str] = Field(None, description="上传人")


class PhotoRecordCreate(PhotoRecordBase):
    node_id: int


class PhotoRecordResponse(PhotoRecordBase):
    id: int
    node_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RectificationOrderBase(BaseModel):
    order_no: str = Field(..., description="整改单号")
    issue_description: Optional[str] = Field(None, description="问题描述")
    required_completion_date: Optional[datetime] = Field(None, description="要求完成日期")
    actual_completion_date: Optional[datetime] = Field(None, description="实际完成日期")
    rectification_status: Optional[str] = Field("pending", description="整改状态")
    is_rework: Optional[bool] = Field(False, description="是否返工")
    rework_count: Optional[int] = Field(0, description="返工次数")
    fine_amount: Optional[float] = Field(0, description="扣款金额")


class RectificationOrderCreate(RectificationOrderBase):
    project_id: int
    node_id: Optional[int] = Field(None)


class RectificationOrderResponse(RectificationOrderBase):
    id: int
    project_id: int
    node_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationDetailResponse(BaseModel):
    id: int
    reconciliation_result_id: int
    node_id: int
    node_name: str
    node_type: Optional[str]
    node_amount: float
    planned_date: Optional[datetime]
    actual_date: Optional[datetime]
    required_photos: int
    actual_photos: int
    photo_status: str
    is_overdue: bool
    overdue_days: int
    has_rectification: bool
    rectification_count: int
    rework_count: int
    fine_amount: float
    is_rework: bool
    final_status: str
    difference_explanation: Optional[str]
    auto_check_result: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationResultBase(BaseModel):
    project_id: int
    batch_no: str
    status: Optional[str] = "draft"


class ReconciliationResultResponse(ReconciliationResultBase):
    id: int
    total_nodes: int
    completed_nodes: int
    missing_photo_nodes: int
    overdue_nodes: int
    rework_count: int
    total_fine_amount: float
    payable_amount: float
    created_at: datetime
    updated_at: datetime
    details: List[ReconciliationDetailResponse] = []

    class Config:
        from_attributes = True


class ReconciliationSummary(BaseModel):
    total_nodes: int
    completed_nodes: int
    completed_rate: float
    missing_photo_nodes: int
    overdue_nodes: int
    rework_count: int
    total_fine_amount: float
    payable_amount: float
    approved_count: int
    rejected_count: int
    need_material_count: int
    pending_count: int


class ReviewRecordCreate(BaseModel):
    reconciliation_detail_id: int
    reviewer: str
    review_action: ReviewAction
    review_comment: Optional[str] = Field(None, description="复核意见")
    adjusted_fine_amount: Optional[float] = Field(None, description="调整后的扣款金额")
    difference_source: Optional[str] = Field(None, description="差异来源说明")
    final_status: Optional[FinalStatus] = Field(None, description="最终状态")
    difference_explanation: Optional[str] = Field(None, description="差异说明")
    evidence: Optional[Dict[str, Any]] = Field(None, description="复核依据")


class ReviewRecordResponse(BaseModel):
    id: int
    reconciliation_result_id: int
    reconciliation_detail_id: Optional[int]
    rectification_order_id: Optional[int]
    reviewer: Optional[str]
    review_action: Optional[str]
    review_comment: Optional[str]
    adjusted_fine_amount: Optional[float]
    review_time: datetime
    difference_source: Optional[str]
    evidence: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    message: str
    imported_count: int
    errors: List[str] = []


class RecalculateResult(BaseModel):
    success: bool
    message: str
    updated_details: int
    updated_summary: Dict[str, Any]


class ReportRequest(BaseModel):
    reconciliation_result_id: int
    report_format: str = Field("excel", description="报告格式：excel/csv")
    include_details: bool = Field(True, description="是否包含明细")
