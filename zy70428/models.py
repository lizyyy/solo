from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class DataSource(str, enum.Enum):
    PEAK_INVOICE_REVERSAL = "peak_invoice_reversal"
    SMS_SEND_RECORD = "sms_send_record"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_MODIFIED = "manual_modified"
    CALIBER_CHANGED = "caliber_changed"


class ExecutionStatus(str, enum.Enum):
    NOT_EXECUTED = "not_executed"
    EXECUTING = "executing"
    EXECUTED = "executed"
    PARTIALLY_EXECUTED = "partially_executed"
    FAILED = "failed"


class InvoiceReversalRecord(Base):
    __tablename__ = "invoice_reversal_records"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String, index=True, comment="发票号码")
    invoice_code = Column(String, comment="发票代码")
    buyer_name = Column(String, comment="购方名称")
    buyer_tax_no = Column(String, comment="购方税号")
    seller_name = Column(String, comment="销方名称")
    seller_tax_no = Column(String, comment="销方税号")
    total_amount = Column(Float, comment="总金额")
    total_tax = Column(Float, comment="总税额")
    reversal_date = Column(DateTime, comment="红冲日期")
    original_invoice_no = Column(String, comment="原发票号码")
    reversal_reason = Column(String, comment="红冲原因")
    department = Column(String, comment="提交部门")
    operator = Column(String, comment="操作人")
    is_peak_period = Column(Boolean, default=True, comment="是否高峰时段")
    data_source = Column(String, default=DataSource.PEAK_INVOICE_REVERSAL)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    candidate_items = relationship("CandidateItem", back_populates="invoice_record")


class SMSSendRecord(Base):
    __tablename__ = "sms_send_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True, comment="批次号")
    phone_number = Column(String, comment="手机号码")
    sms_content = Column(Text, comment="短信内容")
    send_time = Column(DateTime, comment="发送时间")
    send_status = Column(String, comment="发送状态")
    department = Column(String, comment="发送部门")
    operator = Column(String, comment="操作人")
    invoice_related = Column(String, comment="关联发票号")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    candidate_items = relationship("CandidateItem", back_populates="sms_record")


class CandidateList(Base):
    __tablename__ = "candidate_lists"

    id = Column(Integer, primary_key=True, index=True)
    list_name = Column(String, comment="清单名称")
    data_source = Column(String, comment="数据来源")
    caliber_version = Column(String, comment="口径版本")
    total_count = Column(Integer, comment="总条数")
    generated_by = Column(String, comment="生成人")
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    approval_status = Column(String, default=ApprovalStatus.PENDING)
    current_node = Column(String, default="待审批", comment="当前审批节点")
    summary = Column(Text, comment="材料摘要")
    failure_reason = Column(Text, comment="失败原因")
    execution_status = Column(String, default=ExecutionStatus.NOT_EXECUTED, comment="执行状态")
    can_execute = Column(Boolean, default=False, comment="是否可执行")

    items = relationship("CandidateItem", back_populates="candidate_list")
    approval_nodes = relationship("ApprovalNode", back_populates="candidate_list")
    modifications = relationship("ManualModification", back_populates="candidate_list")
    execution_records = relationship("ExecutionRecord", backref="candidate_list")


class CandidateItem(Base):
    __tablename__ = "candidate_items"

    id = Column(Integer, primary_key=True, index=True)
    candidate_list_id = Column(Integer, ForeignKey("candidate_lists.id"))
    invoice_record_id = Column(Integer, ForeignKey("invoice_reversal_records.id"), nullable=True)
    sms_record_id = Column(Integer, ForeignKey("sms_send_records.id"), nullable=True)
    original_value = Column(Text, comment="原始值")
    suggested_value = Column(Text, comment="建议值")
    final_value = Column(Text, comment="最终值")
    system_decision = Column(String, comment="系统判断")
    manual_decision = Column(String, comment="人工判断")
    is_kept = Column(Boolean, default=True, comment="是否保留")
    action_type = Column(String, comment="动作类型: keep/clean/rollback")
    remarks = Column(Text, comment="备注")

    candidate_list = relationship("CandidateList", back_populates="items")
    invoice_record = relationship("InvoiceReversalRecord", back_populates="candidate_items")
    sms_record = relationship("SMSSendRecord", back_populates="candidate_items")


class ApprovalNode(Base):
    __tablename__ = "approval_nodes"

    id = Column(Integer, primary_key=True, index=True)
    candidate_list_id = Column(Integer, ForeignKey("candidate_lists.id"))
    node_name = Column(String, comment="节点名称")
    node_order = Column(Integer, comment="节点顺序")
    approver = Column(String, comment="审批人")
    approval_time = Column(DateTime(timezone=True))
    approval_status = Column(String)
    approval_opinion = Column(Text, comment="审批意见")

    candidate_list = relationship("CandidateList", back_populates="approval_nodes")


class ManualModification(Base):
    __tablename__ = "manual_modifications"

    id = Column(Integer, primary_key=True, index=True)
    candidate_list_id = Column(Integer, ForeignKey("candidate_lists.id"))
    candidate_item_id = Column(Integer, comment="候选项目ID")
    field_name = Column(String, comment="修改字段")
    original_value = Column(Text, comment="修改前值")
    modified_value = Column(Text, comment="修改后值")
    modifier = Column(String, comment="修改人")
    modification_time = Column(DateTime(timezone=True), server_default=func.now())
    modification_remark = Column(Text, comment="修改备注")
    reason = Column(Text, comment="修改原因")

    candidate_list = relationship("CandidateList", back_populates="modifications")


class ProcessingConclusion(Base):
    __tablename__ = "processing_conclusions"

    id = Column(Integer, primary_key=True, index=True)
    candidate_list_id = Column(Integer, ForeignKey("candidate_lists.id"))
    conclusion_content = Column(Text, comment="处理结论")
    material_summary = Column(Text, comment="材料摘要")
    processed_by = Column(String, comment="处理人")
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    is_final = Column(Boolean, default=True)


class ExecutionRecord(Base):
    __tablename__ = "execution_records"

    id = Column(Integer, primary_key=True, index=True)
    candidate_list_id = Column(Integer, ForeignKey("candidate_lists.id"))
    execution_type = Column(String, comment="执行类型: clean/rollback")
    status = Column(String, default=ExecutionStatus.NOT_EXECUTED)
    total_items = Column(Integer, comment="总项目数")
    success_count = Column(Integer, default=0, comment="成功数")
    failed_count = Column(Integer, default=0, comment="失败数")
    executed_by = Column(String, comment="执行人")
    executed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    error_message = Column(Text, comment="错误信息")
    summary = Column(Text, comment="执行摘要")

    details = relationship("ExecutionDetail", back_populates="execution_record")


class ExecutionDetail(Base):
    __tablename__ = "execution_details"

    id = Column(Integer, primary_key=True, index=True)
    execution_record_id = Column(Integer, ForeignKey("execution_records.id"))
    candidate_item_id = Column(Integer, comment="候选项目ID")
    record_type = Column(String, comment="记录类型: invoice/sms")
    record_id = Column(Integer, comment="原始记录ID")
    action_type = Column(String, comment="动作类型: keep/clean/rollback")
    original_value = Column(Text, comment="原始值")
    execution_result = Column(String, comment="执行结果: success/failed/skipped")
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text, comment="备注")

    execution_record = relationship("ExecutionRecord", back_populates="details")
