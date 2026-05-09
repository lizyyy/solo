from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    parent = relationship("Category", remote_side=[id])


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(Text, nullable=False)
    original_category = Column(String(100), nullable=True)
    current_category = Column(String(100), nullable=True)
    status = Column(String(20), default="pending")
    batch_id = Column(String(50), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    corrections = relationship("Correction", back_populates="product", order_by="Correction.created_at.desc()")


class ClassificationRule(Base):
    __tablename__ = "classification_rules"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False, index=True)
    keywords = Column(Text, nullable=False)
    is_active = Column(Integer, default=1)
    priority = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(String(50), index=True, nullable=True)
    old_category = Column(String(100), nullable=True)
    new_category = Column(String(100), nullable=True)
    reason = Column(Text, nullable=True)
    source = Column(String(20), default="auto")
    operator = Column(String(50), nullable=True)
    is_rolled_back = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="corrections")

    __table_args__ = (
        Index('idx_correction_product', 'product_id'),
        Index('idx_correction_batch', 'batch_id'),
    )


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, index=True, nullable=False)
    filename = Column(String(200), nullable=True)
    total_count = Column(Integer, default=0)
    auto_classified_count = Column(Integer, default=0)
    pending_review_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
