from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class DiscrepancyType(str, Enum):
    RECALL = "召回批号差异"
    NEAR_EXPIRY = "近效期预警"
    EXPIRED = "已过期差异"
    TRANSFER = "跨门店调拨差异"
    QUANTITY_MISMATCH = "数量不匹配"
    BATCH_NOT_FOUND = "批号不存在"
    OTHER = "其他差异"


class ReviewAction(str, Enum):
    CONFIRM = "确认差异"
    ADJUST = "调整数据"
    REJECT = "驳回差异"
    MARK_RESOLVED = "标记已解决"


class Discrepancy(BaseModel):
    id: Optional[str] = None
    type: DiscrepancyType = Field(..., description="差异类型")
    batch_number: str = Field(..., description="批号")
    material_name: str = Field(..., description="物料名称")
    store_name: str = Field(..., description="门店名称")
    description: str = Field(..., description="差异描述")
    explanation: str = Field(..., description="差异解释")
    expected_value: Optional[Any] = Field(None, description="期望值")
    actual_value: Optional[Any] = Field(None, description="实际值")
    quantity_diff: Optional[int] = Field(None, description="数量差异")
    related_recall_id: Optional[str] = Field(None, description="关联召回公告ID")
    related_transfer_id: Optional[str] = Field(None, description="关联调拨记录ID")
    is_reviewed: bool = False
    review_action: Optional[ReviewAction] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    adjustment_quantity: Optional[int] = Field(None, description="调整后数量")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True


class ReviewRecord(BaseModel):
    id: Optional[str] = None
    reconciliation_id: str = Field(..., description="对账任务ID")
    discrepancy_id: str = Field(..., description="差异ID")
    action: ReviewAction = Field(..., description="复核操作")
    notes: Optional[str] = Field(None, description="复核备注")
    reviewed_by: str = Field(..., description="复核人")
    old_value: Optional[Any] = Field(None, description="原值")
    new_value: Optional[Any] = Field(None, description="新值")
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True


class ReconciliationStatus(str, Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    COMPLETED = "已完成"
    REVIEWING = "复核中"
    ARCHIVED = "已归档"


class ReconciliationResult(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="对账任务名称")
    start_date: date = Field(..., description="对账开始日期")
    end_date: date = Field(..., description="对账结束日期")
    status: ReconciliationStatus = ReconciliationStatus.PENDING
    total_inventory_count: int = 0
    total_consumption_count: int = 0
    total_recall_count: int = 0
    discrepancy_count: int = 0
    unresolved_discrepancy_count: int = 0
    recalled_batch_count: int = 0
    near_expiry_count: int = 0
    expired_count: int = 0
    transfer_count: int = 0
    discrepancies: List[Discrepancy] = Field(default_factory=list)
    summary_data: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    remarks: Optional[str] = None

    class Config:
        use_enum_values = True
