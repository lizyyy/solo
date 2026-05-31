from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, comment="会议名称")
    meeting_no = Column(String(100), unique=True, index=True, comment="会议编号")
    content = Column(Text, nullable=False, comment="会议内容/纪要")
    file_name = Column(String(255), comment="上传文件名")
    file_path = Column(String(500), comment="文件存储路径")

    status = Column(String(50), default="pending", comment="处理状态: pending, processing, completed, failed")
    total_questions = Column(Integer, default=0, comment="问题总数")
    correct_count = Column(Integer, default=0, comment="正确数量")
    error_count = Column(Integer, default=0, comment="错误数量")
    accuracy = Column(String(20), default="0%", comment="准确率")

    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")

    compare_results = relationship("CompareResult", back_populates="meeting", cascade="all, delete-orphan")
    correction_records = relationship("CorrectionRecord", back_populates="meeting", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="meeting", cascade="all, delete-orphan")
