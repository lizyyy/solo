from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class TaskStatus(str, enum.Enum):
    PROCESSING = "处理中"
    FAILED = "处理失败"
    MANUAL_CONFIRM = "人工确认"
    EXPORTED = "已导出"


class DataCategory(str, enum.Enum):
    NORMAL = "正常"
    PENDING_SUPPLEMENT = "待补充"
    BLOCKED = "已拦截"


class TellerBoxHandover(Base):
    __tablename__ = "teller_box_handovers"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(64), unique=True, index=True, nullable=False)
    branch_id = Column(String(32), nullable=False, comment="网点编号")
    branch_name = Column(String(128), comment="网点名称")
    handover_date = Column(DateTime, nullable=False, comment="交接日期")
    handover_type = Column(String(32), comment="交接类型：早班/晚班/跨日")
    
    box_no = Column(String(64), nullable=False, comment="尾箱编号")
    box_amount = Column(Float, nullable=False, comment="尾箱金额")
    error_no = Column(String(64), comment="差错编号")
    
    handler1_id = Column(String(32), nullable=False, comment="交接人1编号")
    handler1_name = Column(String(64), nullable=False, comment="交接人1姓名")
    handler2_id = Column(String(32), nullable=False, comment="交接人2编号")
    handler2_name = Column(String(64), nullable=False, comment="交接人2姓名")
    
    is_cross_day = Column(Integer, default=0, comment="是否跨日交接：0否1是")
    previous_unclosed_reason = Column(Text, comment="上一班未闭合原因")
    
    raw_data = Column(Text, nullable=False, comment="原始材料JSON")
    category = Column(Enum(DataCategory), comment="数据分类")
    category_reason = Column(Text, comment="分类原因说明")
    subsequent_action = Column(Text, comment="后续动作")
    
    status = Column(Enum(TaskStatus), default=TaskStatus.PROCESSING, comment="任务状态")
    error_details = Column(Text, comment="错误明细")
    raw_data_position = Column(String(256), comment="原始材料位置")
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(64), comment="创建人")
    
    audit_logs = relationship("AuditLog", back_populates="handover")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    handover_id = Column(Integer, ForeignKey("teller_box_handovers.id"))
    task_id = Column(String(64), index=True)
    
    field_changed = Column(String(128), nullable=False, comment="修改的字段")
    old_value = Column(Text, comment="修改前的值")
    new_value = Column(Text, comment="修改后的值")
    change_reason = Column(Text, nullable=False, comment="修改原因")
    
    changed_by_id = Column(String(32), nullable=False, comment="修改人编号")
    changed_by_name = Column(String(64), nullable=False, comment="修改人姓名")
    changed_at = Column(DateTime, server_default=func.now())
    
    handover = relationship("TellerBoxHandover", back_populates="audit_logs")


class FieldTrace(Base):
    __tablename__ = "field_traces"

    id = Column(Integer, primary_key=True, index=True)
    handover_id = Column(Integer, ForeignKey("teller_box_handovers.id"))
    task_id = Column(String(64), index=True)
    
    field_name = Column(String(128), nullable=False, comment="关键字段名")
    raw_value = Column(Text, comment="原始输入值")
    processed_value = Column(Text, comment="处理后的值")
    final_value = Column(Text, comment="最终报告值")
    trace_path = Column(Text, comment="追溯路径")
    
    created_at = Column(DateTime, server_default=func.now())
