from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class CorrectionRecord(Base):
    __tablename__ = "correction_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, comment="会议ID")
    compare_result_id = Column(Integer, ForeignKey("compare_results.id"), comment="比对结果ID")

    original_status = Column(String(50), comment="原始状态")
    corrected_status = Column(String(50), comment="修正后状态")
    original_answer = Column(Text, comment="原始回答")
    corrected_answer = Column(Text, comment="修正后回答")
    correction_reason = Column(Text, comment="修正原因")
    operator = Column(String(100), comment="操作人")

    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    meeting = relationship("Meeting", back_populates="correction_records")
    compare_result = relationship("CompareResult", back_populates="correction_records")
