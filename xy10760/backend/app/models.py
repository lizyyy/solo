from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String(100), unique=True, index=True)
    applicant = Column(String(100))
    department = Column(String(100))
    application_type = Column(String(100))
    amount = Column(Integer, default=0)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    extra_data = Column(JSON, default=dict)

    simulation_results = relationship("SimulationResult", back_populates="application")

class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), index=True)
    name = Column(String(200))
    description = Column(Text)
    is_active = Column(Boolean, default=False)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    hit_conditions = relationship("HitCondition", back_populates="rule_version")
    simulation_results = relationship("SimulationResult", back_populates="rule_version")

class HitCondition(Base):
    __tablename__ = "hit_conditions"

    id = Column(Integer, primary_key=True, index=True)
    rule_version_id = Column(Integer, ForeignKey("rule_versions.id"))
    condition_type = Column(String(100))
    condition_expression = Column(Text)
    condition_value = Column(String(500))
    operator = Column(String(50))
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rule_version = relationship("RuleVersion", back_populates="hit_conditions")

class Approver(Base):
    __tablename__ = "approvers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(200))
    department = Column(String(100))
    level = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SkipReason(Base):
    __tablename__ = "skip_reasons"

    id = Column(Integer, primary_key=True, index=True)
    reason_code = Column(String(100), unique=True)
    reason_text = Column(String(500))
    need_manual_confirm = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id = Column(Integer, primary_key=True, index=True)
    idempotent_key = Column(String(100), unique=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    rule_version_id = Column(Integer, ForeignKey("rule_versions.id"))
    hit_condition_ids = Column(JSON, default=list)
    approver_ids = Column(JSON, default=list)
    approver_names = Column(JSON, default=list)
    skip_reason_id = Column(Integer, ForeignKey("skip_reasons.id"))
    skip_reason_text = Column(String(500))
    skip_manual_confirmed = Column(Boolean, default=False)
    skip_confirmed_by = Column(String(100))
    skip_confirmed_at = Column(DateTime(timezone=True))
    simulation_status = Column(String(50), default="success")
    error_details = Column(Text)
    approver_errors = Column(JSON, default=list)
    final_approval_result = Column(String(50))
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True))
    published_by = Column(String(100))

    application = relationship("Application", back_populates="simulation_results")
    rule_version = relationship("RuleVersion", back_populates="simulation_results")
