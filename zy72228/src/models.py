from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class ApprovalStatus(str, Enum):
    PENDING = "待确认"
    APPROVED = "已确认"
    REJECTED = "已驳回"
    PENDING_REVIEW = "待基金经理复核"
    REVIEWED = "已复核"


class RecordSource(str, Enum):
    NORMAL = "正常导入"
    WRONG_FORMAT = "错口径"
    SUPPLEMENT = "补录材料"
    MANUAL = "手工修改"


class SettlementType(str, Enum):
    T1 = "T+1"
    T2 = "T+2"


class CounterFlow(BaseModel):
    flow_id: str = Field(..., description="流水号")
    flow_tail: str = Field(..., description="柜台流水尾号")
    trade_date: date = Field(..., description="交易日期")
    amount: float = Field(..., description="金额")
    currency: str = Field(default="CNY", description="币种")
    counterparty: str = Field(..., description="对手方")
    settlement_type: SettlementType = Field(default=SettlementType.T1, description="到账类型")
    remark: str = Field(default="", description="原始备注")
    import_time: datetime = Field(default_factory=datetime.now)
    source: RecordSource = Field(default=RecordSource.NORMAL)
    is_manual_modified: bool = Field(default=False)
    modified_by: Optional[str] = None
    modified_time: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True


class MarginRecord(BaseModel):
    record_id: str = Field(..., description="记录ID")
    trade_date: date = Field(..., description="交易日期")
    margin_type: str = Field(..., description="保证金类型")
    amount: float = Field(..., description="金额")
    direction: str = Field(..., description="方向(缴/退)")
    linked_flow_id: Optional[str] = Field(None, description="关联流水号")
    email_remark: str = Field(default="", description="客户经理邮件备注")
    email_attachment_info: str = Field(default="", description="邮件附件信息")
    import_time: datetime = Field(default_factory=datetime.now)
    source: RecordSource = Field(default=RecordSource.NORMAL)
    approval_status: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    approved_by: Optional[str] = None
    approved_time: Optional[datetime] = None
    version: int = Field(default=1)
    parent_record_id: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True


class ReconciliationNote(BaseModel):
    note_id: str = Field(..., description="对账说明ID")
    trade_date: date = Field(..., description="交易日期")
    content: str = Field(..., description="对账说明内容")
    related_record_ids: List[str] = Field(default_factory=list)
    related_flow_ids: List[str] = Field(default_factory=list)
    created_by: str = Field(..., description="创建人")
    created_time: datetime = Field(default_factory=datetime.now)
    updated_by: Optional[str] = None
    updated_time: Optional[datetime] = None
    version: int = Field(default=1)
    history: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True


class ConflictRecord(BaseModel):
    conflict_id: str = Field(..., description="冲突ID")
    trade_date: date = Field(..., description="交易日期")
    flow_id: str = Field(..., description="流水号")
    flow_tail_counter: str = Field(..., description="柜台流水尾号")
    flow_tail_email: str = Field(..., description="邮件备注中的尾号")
    counter_amount: float = Field(..., description="柜台金额")
    email_amount: Optional[float] = Field(None, description="邮件金额")
    email_remark: str = Field(..., description="邮件备注原文")
    detected_time: datetime = Field(default_factory=datetime.now)
    resolution: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    resolved_by: Optional[str] = None
    resolved_time: Optional[datetime] = None
    resolution_note: Optional[str] = None


class ImportResult(BaseModel):
    success_count: int = 0
    failed_count: int = 0
    conflict_count: int = 0
    imported_records: List[MarginRecord] = Field(default_factory=list)
    imported_flows: List[CounterFlow] = Field(default_factory=list)
    conflicts: List[ConflictRecord] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    import_time: datetime = Field(default_factory=datetime.now)
    source_type: RecordSource = Field(default=RecordSource.NORMAL)


class SelfCheckItem(BaseModel):
    check_name: str = Field(..., description="检查项名称")
    check_type: str = Field(..., description="检查类型")
    passed: bool = Field(..., description="是否通过")
    message: str = Field(..., description="检查结果说明")
    details: List[str] = Field(default_factory=list)
    affected_records: List[str] = Field(default_factory=list)


class SelfCheckResult(BaseModel):
    check_time: datetime = Field(default_factory=datetime.now)
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    check_items: List[SelfCheckItem] = Field(default_factory=list)
    overall_passed: bool = Field(default=True)

    def add_item(self, item: SelfCheckItem):
        self.check_items.append(item)
        self.total_checks += 1
        if item.passed:
            self.passed_checks += 1
        else:
            self.failed_checks += 1
            self.overall_passed = False
