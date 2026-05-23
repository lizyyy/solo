from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class DataSource(str, enum.Enum):
    RECEIPT = "领用单"
    PURCHASE_ARRIVAL = "采购到货表"
    TEACHER_SIGN = "老师补签记录"
    TEMP_SUPPLEMENT = "临时补录单"
    SHIFT_RECORD = "班次记录"


class ConsumableStatus(str, enum.Enum):
    PENDING = "待验收"
    ACCEPTED = "已验收"
    REJECTED = "已驳回"
    BORROWED = "课题组借用"
    LOST = "损耗"
    AUDIT_PENDING = "待审计"
    AUDIT_PASS = "审计通过"
    EXCEPTION = "异常"
    RESOLVED = "已解决"


class TaskStatus(str, enum.Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    WAIT_RETRY = "等重试"
    WAIT_MANUAL = "等人工"
    FAILED_PERMANENT = "永久失败"
    COMPLETED = "已完成"


class ConsumableRecord(Base):
    __tablename__ = "consumable_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(100), unique=True, index=True, comment="记录编号")
    consumable_name = Column(String(200), comment="耗材名称")
    specification = Column(String(200), comment="规格型号")
    quantity = Column(Float, comment="数量")
    unit = Column(String(50), comment="单位")
    batch_no = Column(String(100), comment="批号")
    expire_date = Column(DateTime, comment="有效期")
    supplier = Column(String(200), comment="供应商")
    
    current_status = Column(String(50), default=ConsumableStatus.PENDING.value, comment="当前状态")
    data_source = Column(String(50), comment="数据来源")
    
    lab = Column(String(100), comment="实验室")
    research_group = Column(String(100), comment="课题组")
    
    is_duplicate = Column(Boolean, default=False, comment="是否重复")
    duplicate_of = Column(Integer, ForeignKey("consumable_records.id"), nullable=True, comment="重复记录ID")
    
    original_file_name = Column(String(200), comment="原始文件名")
    original_row_number = Column(Integer, comment="原始行号")
    original_data = Column(JSON, comment="原始数据")
    
    missing_direction_reason = Column(Text, comment="缺去向处理原因")
    borrow_loss_mixed = Column(Boolean, default=False, comment="借用和损耗混合")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), comment="创建人")

    status_history = relationship("StatusHistory", back_populates="record", cascade="all, delete-orphan")
    import_evidence = relationship("ImportEvidence", back_populates="record", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="record")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    from_status = Column(String(50), comment="原状态")
    to_status = Column(String(50), comment="新状态")
    change_reason = Column(Text, comment="变更原因")
    operator = Column(String(100), comment="操作者")
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text, comment="备注")

    record = relationship("ConsumableRecord", back_populates="status_history")


class ImportEvidence(Base):
    __tablename__ = "import_evidence"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    source_file_name = Column(String(200), comment="来源文件名")
    source_file_path = Column(String(500), comment="来源文件路径")
    source_row_number = Column(Integer, comment="来源行号")
    original_raw_value = Column(JSON, comment="原始值")
    parsed_standard_value = Column(JSON, comment="解析后标准值")
    is_manual_corrected = Column(Boolean, default=False, comment="是否人工改判")
    correction_history = Column(JSON, comment="改判历史")
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    imported_by = Column(String(100), comment="导入人")

    record = relationship("ConsumableRecord", back_populates="import_evidence")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, comment="任务ID")
    task_type = Column(String(50), comment="任务类型")
    status = Column(String(50), default=TaskStatus.PENDING.value, comment="任务状态")
    retry_count = Column(Integer, default=0, comment="重试次数")
    max_retry_count = Column(Integer, default=3, comment="最大重试次数")
    next_retry_time = Column(DateTime, comment="下次重试时间")
    error_message = Column(Text, comment="错误信息")
    error_stack = Column(Text, comment="错误堆栈")
    task_params = Column(JSON, comment="任务参数")
    task_result = Column(JSON, comment="任务结果")
    created_by = Column(String(100), comment="创建人")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime, comment="开始时间")
    completed_at = Column(DateTime, comment="完成时间")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"), nullable=True)
    action = Column(String(100), comment="操作动作")
    module = Column(String(100), comment="模块")
    operator = Column(String(100), comment="操作者")
    action_time = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(50), comment="IP地址")
    user_agent = Column(String(500), comment="用户代理")
    request_params = Column(JSON, comment="请求参数")
    before_data = Column(JSON, comment="变更前数据")
    after_data = Column(JSON, comment="变更后数据")
    diff_data = Column(JSON, comment="差异数据")
    remark = Column(Text, comment="备注")

    record = relationship("ConsumableRecord", back_populates="audit_logs")


class ReplayException(Base):
    __tablename__ = "replay_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    exception_code = Column(String(100), unique=True, index=True, comment="异常编号")
    exception_type = Column(String(100), comment="异常类型")
    description = Column(Text, comment="异常描述")
    related_record_ids = Column(JSON, comment="关联记录ID")
    status = Column(String(50), default="待处理", comment="处理状态")
    resolution = Column(Text, comment="处理方案")
    resolved_by = Column(String(100), comment="处理人")
    resolved_at = Column(DateTime, comment="处理时间")
    before_correction = Column(JSON, comment="修正前数据")
    after_correction = Column(JSON, comment="修正后数据")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
