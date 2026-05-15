from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..core.database import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    key = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=False)
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)
    current_version = Column(Integer, default=1)

    gray_rules = relationship("GrayRule", back_populates="feature_flag", cascade="all, delete-orphan")
    change_orders = relationship("ChangeOrder", back_populates="feature_flag", cascade="all, delete-orphan")
    rollback_versions = relationship("RollbackVersion", back_populates="feature_flag", cascade="all, delete-orphan")
    hit_records = relationship("HitRecord", back_populates="feature_flag", cascade="all, delete-orphan")
    read_audits = relationship("ReadAudit", back_populates="feature_flag", cascade="all, delete-orphan")


class GrayRule(Base):
    __tablename__ = "gray_rules"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    rule_type = Column(String, nullable=False)
    percentage = Column(Float, default=0)
    user_ids = Column(JSON, default=list)
    user_groups = Column(JSON, default=list)
    regions = Column(JSON, default=list)
    conditions = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="gray_rules")


class ReadSource(Base):
    __tablename__ = "read_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    description = Column(Text)
    api_key = Column(String, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChangeOrder(Base):
    __tablename__ = "change_orders"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    order_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    before_data = Column(JSON)
    after_data = Column(JSON)
    status = Column(String, default="pending")
    created_by = Column(String)
    approved_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    executed_at = Column(DateTime)

    feature_flag = relationship("FeatureFlag", back_populates="change_orders")


class HitRecord(Base):
    __tablename__ = "hit_records"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    user_id = Column(String)
    user_group = Column(String)
    region = Column(String)
    hit_result = Column(Boolean)
    source = Column(String)
    request_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="hit_records")


class RollbackVersion(Base):
    __tablename__ = "rollback_versions"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    version = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    description = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="rollback_versions")


class ReadAudit(Base):
    __tablename__ = "read_audits"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    source_id = Column(Integer)
    source_name = Column(String)
    source_type = Column(String)
    user_identifier = Column(String)
    result = Column(Boolean)
    request_ip = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="read_audits")
