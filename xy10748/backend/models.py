from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    name = Column(String(100))
    email = Column(String(100))
    role = Column(String(50))
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class FormTemplate(Base):
    __tablename__ = "form_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    description = Column(Text)
    fields = Column(JSON)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Workflow(Base):
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    description = Column(Text)
    form_template_id = Column(Integer, ForeignKey("form_templates.id"))
    nodes = Column(JSON)
    edges = Column(JSON)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class FormSubmission(Base):
    __tablename__ = "form_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_no = Column(String(100), unique=True, index=True)
    form_template_id = Column(Integer, ForeignKey("form_templates.id"))
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    submitter_id = Column(Integer, ForeignKey("users.id"))
    form_data = Column(JSON)
    status = Column(String(50), default="draft")
    current_node_id = Column(String(100))
    approval_history = Column(JSON, default=list)
    timeout_reminded = Column(Boolean, default=False)
    is_withdrawn = Column(Boolean, default=False)
    resubmit_count = Column(Integer, default=0)
    parent_submission_id = Column(Integer, ForeignKey("form_submissions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    submitter = relationship("User", foreign_keys=[submitter_id])


class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("form_submissions.id"))
    node_id = Column(String(100))
    node_name = Column(String(200))
    approver_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50))
    comment = Column(Text)
    approved_at = Column(DateTime, default=datetime.utcnow)
    is_timeout = Column(Boolean, default=False)
    
    approver = relationship("User")


class ValidationRule(Base):
    __tablename__ = "validation_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    node_id = Column(String(100))
    field_name = Column(String(100))
    rule_type = Column(String(50))
    rule_config = Column(JSON)
    error_message = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
