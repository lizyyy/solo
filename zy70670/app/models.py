from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class ProductStatus(str, enum.Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    END_OF_LIFE = "end_of_life"
    PENDING_REVIEW = "pending_review"


class ReferenceStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    RESOLVED = "resolved"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    PROCESSED = "processed"


class FailureReason(str, enum.Enum):
    PRODUCT_OFFLINE = "product_offline"
    LINK_BROKEN = "link_broken"
    PROCESS_OUTDATED = "process_outdated"
    CONTENT_ERROR = "content_error"
    OTHER = "other"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    status = Column(Enum(ProductStatus), default=ProductStatus.ACTIVE)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    articles = relationship("Article", back_populates="product")


class KnowledgeDirectory(Base):
    __tablename__ = "knowledge_directories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    path = Column(String(500), unique=True, index=True)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("knowledge_directories.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("KnowledgeDirectory", remote_side=[id])
    articles = relationship("Article", back_populates="directory")


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(String(500), unique=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    directory_id = Column(Integer, ForeignKey("knowledge_directories.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_scanned_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", back_populates="articles")
    directory = relationship("KnowledgeDirectory", back_populates="articles")
    outgoing_references = relationship(
        "ArticleReference",
        foreign_keys="ArticleReference.source_article_id",
        back_populates="source_article"
    )
    incoming_references = relationship(
        "ArticleReference",
        foreign_keys="ArticleReference.target_article_id",
        back_populates="target_article"
    )


class ArticleReference(Base):
    __tablename__ = "article_references"

    id = Column(Integer, primary_key=True, index=True)
    source_article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    target_article_id = Column(Integer, ForeignKey("articles.id"), nullable=True)
    target_url = Column(String(500), nullable=False)
    link_text = Column(String(255), nullable=True)
    reference_count = Column(Integer, default=1)
    status = Column(Enum(ReferenceStatus), default=ReferenceStatus.PENDING)
    failure_reason = Column(Enum(FailureReason), nullable=True)
    failure_detail = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    source_article = relationship(
        "Article",
        foreign_keys=[source_article_id],
        back_populates="outgoing_references"
    )
    target_article = relationship(
        "Article",
        foreign_keys=[target_article_id],
        back_populates="incoming_references"
    )


class HealthReport(Base):
    __tablename__ = "health_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50), nullable=False)
    total_articles = Column(Integer, default=0)
    total_references = Column(Integer, default=0)
    invalid_references = Column(Integer, default=0)
    deprecated_product_references = Column(Integer, default=0)
    broken_links = Column(Integer, default=0)
    needs_review_count = Column(Integer, default=0)
    report_data = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String(100), nullable=True)
