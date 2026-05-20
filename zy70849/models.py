from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class ClaimSubmission(Base):
    __tablename__ = "claim_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True)
    policy_no = Column(String, index=True)
    claimant_name = Column(String)
    submit_time = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Float)
    status = Column(String, default="pending")
    
    materials = relationship("ClaimMaterial", back_populates="submission")
    audit_results = relationship("AuditResult", back_populates="submission")

class ClaimMaterial(Base):
    __tablename__ = "claim_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("claim_submissions.id"))
    material_type = Column(String)
    file_name = Column(String)
    amount = Column(Float, default=0)
    is_valid = Column(Boolean, default=True)
    
    submission = relationship("ClaimSubmission", back_populates="materials")

class AuditRule(Base):
    __tablename__ = "audit_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String, unique=True, index=True)
    rule_name = Column(String)
    rule_type = Column(String)
    condition = Column(Text)
    severity = Column(String)
    suggestion = Column(Text)
    is_active = Column(Boolean, default=True)

class AuditResult(Base):
    __tablename__ = "audit_results"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("claim_submissions.id"))
    material_id = Column(Integer, ForeignKey("claim_materials.id"))
    rule_code = Column(String)
    result_type = Column(String)
    result_status = Column(String)
    suggestion = Column(Text)
    source_rule = Column(String)
    audit_time = Column(DateTime, default=datetime.utcnow)
    reviewer = Column(String, nullable=True)
    review_comment = Column(Text, nullable=True)
    
    submission = relationship("ClaimSubmission", back_populates="audit_results")
    material = relationship("ClaimMaterial")

class PolicyInfo(Base):
    __tablename__ = "policy_info"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_no = Column(String, unique=True, index=True)
    policy_holder = Column(String)
    coverage_amount = Column(Float)
    effective_date = Column(DateTime)
    expiry_date = Column(DateTime)
    product_name = Column(String)
