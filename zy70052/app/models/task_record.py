from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from app.database import Base


class TaskRecord(Base):
    __tablename__ = "task_records"
    __table_args__ = (
        Index("idx_task_name", "task_name"),
        Index("idx_status", "status"),
        Index("idx_business_no", "business_no"),
        Index("idx_next_execution_time", "next_execution_time"),
        {"comment": "后台任务记录表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    task_name = Column(String(64), nullable=False, index=True, comment="任务名称")
    task_type = Column(String(32), nullable=False, comment="任务类型")
    
    business_type = Column(String(32), nullable=True, comment="业务类型")
    business_no = Column(String(32), nullable=True, index=True, comment="业务编号")
    business_id = Column(Integer, nullable=True, comment="业务主键ID")
    
    task_parameters = Column(Text, nullable=True, comment="任务参数(JSON)")
    task_description = Column(String(256), nullable=True, comment="任务描述")
    
    status = Column(String(16), nullable=False, default="PENDING", index=True, comment="任务状态")
    
    execution_count = Column(Integer, nullable=False, default=0, comment="执行次数")
    max_execution_count = Column(Integer, nullable=False, default=3, comment="最大执行次数")
    
    last_execution_time = Column(DateTime, nullable=True, comment="上次执行时间")
    next_execution_time = Column(DateTime, nullable=True, index=True, comment="下次执行时间")
    last_successful_execution_time = Column(DateTime, nullable=True, comment="上次成功执行时间")
    
    last_error_message = Column(Text, nullable=True, comment="上次错误信息")
    last_error_stack = Column(Text, nullable=True, comment="上次错误堆栈")
    first_error_time = Column(DateTime, nullable=True, comment="首次错误时间")
    last_error_time = Column(DateTime, nullable=True, comment="上次错误时间")
    
    execution_result = Column(Text, nullable=True, comment="执行结果(JSON)")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, comment="更新时间")
    
    version = Column(Integer, nullable=False, default=0, comment="版本号(乐观锁)")
