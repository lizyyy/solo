from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DataSource(str, Enum):
    PEAK_INVOICE_REVERSAL = "peak_invoice_reversal"
    SMS_SEND_RECORD = "sms_send_record"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_MODIFIED = "manual_modified"
    CALIBER_CHANGED = "caliber_changed"


class ExecutionStatus(str, Enum):
    NOT_EXECUTED = "not_executed"
    EXECUTING = "executing"
    EXECUTED = "executed"
    PARTIALLY_EXECUTED = "partially_executed"
    FAILED = "failed"


class InvoiceReversalRecordBase(BaseModel):
    invoice_no: str = Field(description="发票号码")
    invoice_code: Optional[str] = Field(None, description="发票代码")
    buyer_name: Optional[str] = Field(None, description="购方名称")
    buyer_tax_no: Optional[str] = Field(None, description="购方税号")
    seller_name: Optional[str] = Field(None, description="销方名称")
    seller_tax_no: Optional[str] = Field(None, description="销方税号")
    total_amount: Optional[float] = Field(None, description="总金额")
    total_tax: Optional[float] = Field(None, description="总税额")
    reversal_date: Optional[datetime] = Field(None, description="红冲日期")
    original_invoice_no: Optional[str] = Field(None, description="原发票号码")
    reversal_reason: Optional[str] = Field(None, description="红冲原因")
    department: Optional[str] = Field(None, description="提交部门")
    operator: Optional[str] = Field(None, description="操作人")
    is_peak_period: bool = Field(True, description="是否高峰时段")


class InvoiceReversalRecordCreate(InvoiceReversalRecordBase):
    pass


class InvoiceReversalRecord(InvoiceReversalRecordBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SMSSendRecordBase(BaseModel):
    batch_no: str = Field(description="批次号")
    phone_number: str = Field(description="手机号码")
    sms_content: Optional[str] = Field(None, description="短信内容")
    send_time: Optional[datetime] = Field(None, description="发送时间")
    send_status: Optional[str] = Field(None, description="发送状态")
    department: Optional[str] = Field(None, description="发送部门")
    operator: Optional[str] = Field(None, description="操作人")
    invoice_related: Optional[str] = Field(None, description="关联发票号")


class SMSSendRecordCreate(SMSSendRecordBase):
    pass


class SMSSendRecord(SMSSendRecordBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CandidateItemBase(BaseModel):
    invoice_record_id: Optional[int] = None
    sms_record_id: Optional[int] = None
    original_value: Optional[str] = Field(None, description="原始值")
    suggested_value: Optional[str] = Field(None, description="建议值")
    final_value: Optional[str] = Field(None, description="最终值")
    system_decision: Optional[str] = Field(None, description="系统判断")
    manual_decision: Optional[str] = Field(None, description="人工判断")
    is_kept: bool = Field(True, description="是否保留")
    action_type: Optional[str] = Field(None, description="动作类型: keep/clean/rollback")
    remarks: Optional[str] = Field(None, description="备注")


class CandidateItemCreate(CandidateItemBase):
    pass


class CandidateItem(CandidateItemBase):
    id: int
    candidate_list_id: int

    class Config:
        from_attributes = True


class ApprovalNodeBase(BaseModel):
    node_name: str = Field(description="节点名称")
    node_order: int = Field(description="节点顺序")
    approver: Optional[str] = Field(None, description="审批人")
    approval_status: Optional[str] = None
    approval_opinion: Optional[str] = Field(None, description="审批意见")


class ApprovalNodeCreate(ApprovalNodeBase):
    pass


class ApprovalNode(ApprovalNodeBase):
    id: int
    candidate_list_id: int
    approval_time: Optional[datetime]

    class Config:
        from_attributes = True


class ManualModificationBase(BaseModel):
    candidate_item_id: int = Field(description="候选项目ID")
    field_name: str = Field(description="修改字段")
    original_value: str = Field(description="修改前值")
    modified_value: str = Field(description="修改后值")
    modifier: str = Field(description="修改人")
    modification_remark: str = Field(description="修改备注")
    reason: Optional[str] = Field(None, description="修改原因")


class ManualModificationCreate(ManualModificationBase):
    pass


class ManualModification(ManualModificationBase):
    id: int
    candidate_list_id: int
    modification_time: datetime

    class Config:
        from_attributes = True


class CandidateListBase(BaseModel):
    list_name: str = Field(description="清单名称")
    data_source: DataSource = Field(description="数据来源")
    caliber_version: str = Field(description="口径版本")
    generated_by: str = Field(description="生成人")
    summary: Optional[str] = Field(None, description="材料摘要")


class CandidateListCreate(CandidateListBase):
    items: List[CandidateItemCreate]
    approval_nodes: List[ApprovalNodeCreate]


class CandidateList(CandidateListBase):
    id: int
    total_count: int
    generated_at: datetime
    approval_status: ApprovalStatus
    current_node: str
    failure_reason: Optional[str]
    execution_status: ExecutionStatus
    can_execute: bool
    items: List[CandidateItem]
    approval_nodes: List[ApprovalNode]
    modifications: List[ManualModification]

    class Config:
        from_attributes = True


class ProcessingConclusionBase(BaseModel):
    candidate_list_id: int
    conclusion_content: str = Field(description="处理结论")
    material_summary: str = Field(description="材料摘要")
    processed_by: str = Field(description="处理人")


class ProcessingConclusionCreate(ProcessingConclusionBase):
    pass


class ProcessingConclusion(ProcessingConclusionBase):
    id: int
    processed_at: datetime
    is_final: bool

    class Config:
        from_attributes = True


class ApprovalRequest(BaseModel):
    candidate_list_id: int
    node_name: str
    approver: str
    approval_status: ApprovalStatus
    approval_opinion: Optional[str] = None


class ManualModifyRequest(BaseModel):
    candidate_list_id: int
    candidate_item_id: int
    field_name: str
    modified_value: str
    modifier: str
    modification_remark: str
    reason: Optional[str] = None


class ExportRequest(BaseModel):
    candidate_list_id: int
    include_sms_details: bool = True
    filter_by_node: Optional[str] = None


class GenerateCandidateListRequest(BaseModel):
    list_name: str
    data_source: DataSource
    caliber_version: str
    generated_by: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    department: Optional[str] = None


class ExecutionRequest(BaseModel):
    candidate_list_id: int
    execution_type: str = Field(description="执行类型: clean/rollback")
    executed_by: str = Field(description="执行人")
    dry_run: bool = Field(True, description="是否试运行")


class ExecutionDetailBase(BaseModel):
    candidate_item_id: int
    record_type: str
    record_id: int
    action_type: str
    original_value: Optional[str] = None
    execution_result: Optional[str] = None
    remark: Optional[str] = None


class ExecutionDetail(ExecutionDetailBase):
    id: int
    execution_record_id: int
    executed_at: datetime

    class Config:
        from_attributes = True


class ExecutionRecordBase(BaseModel):
    candidate_list_id: int
    execution_type: str
    status: ExecutionStatus
    total_items: Optional[int] = None
    success_count: Optional[int] = None
    failed_count: Optional[int] = None
    executed_by: Optional[str] = None
    error_message: Optional[str] = None
    summary: Optional[str] = None


class ExecutionRecord(ExecutionRecordBase):
    id: int
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    details: List[ExecutionDetail] = []

    class Config:
        from_attributes = True
