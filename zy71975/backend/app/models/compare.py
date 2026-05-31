from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship

from app.core.database import Base


class CompareResult(Base):
    __tablename__ = "compare_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, comment="会议ID")
    knowledge_id = Column(Integer, ForeignKey("knowledge.id"), comment="知识库ID")
    knowledge_version = Column(String(50), comment="比对时知识库版本")

    question = Column(Text, nullable=False, comment="问题")
    standard_answer = Column(Text, comment="标准答案")
    meeting_answer = Column(Text, comment="会议回答")

    similarity = Column(Float, default=0.0, comment="相似度")
    is_match = Column(Boolean, default=False, comment="是否匹配")
    status = Column(String(50), default="pending", comment="状态: pending, correct, error, need_review")
    error_type = Column(String(100), comment="错误类型: missing, wrong, incomplete")
    confidence = Column(Float, default=0.0, comment="置信度")

    is_affected_by_version = Column(Boolean, default=False, comment="是否受版本变更影响")
    affected_version = Column(String(50), comment="影响的版本")

    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")

    meeting = relationship("Meeting", back_populates="compare_results")
    knowledge = relationship("Knowledge", back_populates="compare_results")
    details = relationship("CompareDetail", back_populates="compare_result", cascade="all, delete-orphan")
    correction_records = relationship("CorrectionRecord", back_populates="compare_result", cascade="all, delete-orphan")


class CompareDetail(Base):
    __tablename__ = "compare_details"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    compare_result_id = Column(Integer, ForeignKey("compare_results.id"), nullable=False, comment="比对结果ID")
    detail_type = Column(String(50), comment="详情类型: keyword_match, sentence_diff, version_diff")
    standard_part = Column(Text, comment="标准部分")
    meeting_part = Column(Text, comment="会议部分")
    diff_content = Column(Text, comment="差异内容")
    similarity = Column(Float, default=0.0, comment="相似度")
    remark = Column(String(500), comment="备注")

    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    compare_result = relationship("CompareResult", back_populates="details")
