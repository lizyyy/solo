from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), comment="会议ID")
    operation_type = Column(String(50), nullable=False, comment="操作类型: upload, compare, correct, export, delete")
    operation_detail = Column(Text, comment="操作详情")
    operator = Column(String(100), comment="操作人")
    ip_address = Column(String(50), comment="IP地址")
    status = Column(String(50), default="success", comment="状态: success, failed")
    error_message = Column(Text, comment="错误信息")

    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    meeting = relationship("Meeting", back_populates="operation_logs")
