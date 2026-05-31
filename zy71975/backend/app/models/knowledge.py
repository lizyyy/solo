from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Knowledge(Base):
    __tablename__ = "knowledge"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, comment="知识库名称")
    knowledge_type = Column(String(50), comment="知识库类型: question, standard, process")
    content = Column(Text, nullable=False, comment="知识库内容")
    keywords = Column(Text, comment="关键词，逗号分隔")
    version = Column(String(50), default="1.0", comment="当前版本号")

    is_active = Column(Boolean, default=True, comment="是否启用")
    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")

    versions = relationship("KnowledgeVersion", back_populates="knowledge", cascade="all, delete-orphan", order_by="desc(KnowledgeVersion.version)")
    compare_results = relationship("CompareResult", back_populates="knowledge")


class KnowledgeVersion(Base):
    __tablename__ = "knowledge_versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    knowledge_id = Column(Integer, ForeignKey("knowledge.id"), nullable=False, comment="知识库ID")
    version = Column(String(50), nullable=False, comment="版本号")
    content = Column(Text, nullable=False, comment="版本内容")
    keywords = Column(Text, comment="版本关键词")
    change_description = Column(String(500), comment="变更描述")
    affected_questions = Column(Text, comment="受影响的问题ID，逗号分隔")

    is_deleted = Column(Boolean, default=False, comment="是否删除")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    knowledge = relationship("Knowledge", back_populates="versions")
