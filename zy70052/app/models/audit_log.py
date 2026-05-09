from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_time", "audit_time"),
        Index("idx_business_type", "business_type"),
        Index("idx_operation_type", "operation_type"),
        Index("idx_operator_id", "operator_id"),
        Index("idx_business_no", "business_no"),
        {"comment": "审计日志表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    log_no = Column(String(32), unique=True, nullable=False, index=True, comment="日志编号")
    
    audit_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True, comment="审计时间")
    
    business_type = Column(String(32), nullable=False, index=True, comment="业务类型")
    business_no = Column(String(32), nullable=True, index=True, comment="业务编号")
    business_id = Column(Integer, nullable=True, comment="业务主键ID")
    
    operation_type = Column(String(32), nullable=False, index=True, comment="操作类型")
    operation_desc = Column(String(256), nullable=True, comment="操作描述")
    
    operator_id = Column(String(32), nullable=True, index=True, comment="操作人ID")
    operator_name = Column(String(64), nullable=True, comment="操作人姓名")
    operator_type = Column(String(16), nullable=False, default="SYSTEM", comment="操作人类型")
    
    request_path = Column(String(256), nullable=True, comment="请求路径")
    request_method = Column(String(16), nullable=True, comment="请求方法")
    request_ip = Column(String(64), nullable=True, comment="请求IP")
    
    before_data = Column(Text, nullable=True, comment="操作前数据(JSON)")
    after_data = Column(Text, nullable=True, comment="操作后数据(JSON)")
    
    operation_result = Column(String(16), nullable=False, default="SUCCESS", comment="操作结果")
    error_message = Column(Text, nullable=True, comment="错误信息")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
