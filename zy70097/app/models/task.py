from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BackgroundTask(Base):
    __tablename__ = "background_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, nullable=False, index=True, comment="任务ID")
    task_type = Column(String(100), nullable=False, comment="任务类型: baseline_calculation, saving_calculation, data_import, export")
    
    status = Column(String(50), default="pending", comment="状态: pending, running, completed, failed, retrying")
    progress = Column(Integer, default=0, comment="进度 0-100")
    
    retry_count = Column(Integer, default=0, comment="重试次数")
    max_retries = Column(Integer, default=3, comment="最大重试次数")
    next_retry_at = Column(DateTime, nullable=True, comment="下次重试时间")
    
    parameters = Column(JSON, nullable=True, comment="任务参数")
    result = Column(JSON, nullable=True, comment="任务结果")
    
    error_message = Column(Text, nullable=True, comment="错误信息")
    error_traceback = Column(Text, nullable=True, comment="错误堆栈")
    
    started_at = Column(DateTime, nullable=True, comment="开始时间")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")
    
    created_by = Column(String(100), nullable=True, comment="创建人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    export_file = Column(String(500), nullable=True, comment="导出文件路径")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, comment="操作类型")
    target_type = Column(String(100), nullable=False, comment="目标类型")
    target_id = Column(Integer, nullable=True, comment="目标ID")
    
    old_value = Column(JSON, nullable=True, comment="旧值")
    new_value = Column(JSON, nullable=True, comment="新值")
    
    changed_by = Column(String(100), nullable=True, comment="操作人")
    changed_at = Column(DateTime, default=datetime.utcnow, comment="操作时间")
    
    remark = Column(Text, nullable=True, comment="备注")
