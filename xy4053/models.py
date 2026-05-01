from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from config import CaseStatus, RiskLevel


class Counselor(Base):
    __tablename__ = "counselors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=True)
    qualification = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Integer, default=1)
    
    cases = relationship("Case", back_populates="counselor")


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    counselor_id = Column(Integer, ForeignKey("counselors.id"))
    status = Column(SQLEnum(CaseStatus), default=CaseStatus.DRAFT)
    risk_level = Column(SQLEnum(RiskLevel), default=RiskLevel.LOW)
    
    presenting_problem = Column(Text, nullable=True)
    background_info = Column(Text, nullable=True)
    assessment_process = Column(Text, nullable=True)
    intervention_strategy = Column(Text, nullable=True)
    
    sds_score = Column(Float, nullable=True)
    sas_score = Column(Float, nullable=True)
    scl90_score = Column(Float, nullable=True)
    gad7_score = Column(Float, nullable=True)
    phq9_score = Column(Float, nullable=True)
    
    risk_factors = Column(Text, nullable=True)
    protective_factors = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    
    counselor = relationship("Counselor", back_populates="cases")
    desensitized_versions = relationship("DesensitizedVersion", back_populates="case")
    risk_assessments = relationship("RiskAssessment", back_populates="case")
    supervision_feedbacks = relationship("SupervisionFeedback", back_populates="case")
    crisis_escalations = relationship("CrisisEscalation", back_populates="case")
    status_transitions = relationship("StatusTransition", back_populates="case")
    audit_logs = relationship("AuditLog", back_populates="case")


class DesensitizedVersion(Base):
    __tablename__ = "desensitized_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    version_number = Column(Integer, default=1)
    
    presenting_problem = Column(Text, nullable=True)
    background_info = Column(Text, nullable=True)
    assessment_process = Column(Text, nullable=True)
    intervention_strategy = Column(Text, nullable=True)
    
    desensitization_check_passed = Column(Integer, default=0)
    sensitive_fields_found = Column(Text, nullable=True)
    desensitization_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("counselors.id"))
    
    case = relationship("Case", back_populates="desensitized_versions")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    assessment_version = Column(Integer, default=1)
    
    risk_level = Column(SQLEnum(RiskLevel), nullable=False)
    assessment_date = Column(DateTime, default=datetime.utcnow)
    assessor_id = Column(Integer, ForeignKey("counselors.id"))
    
    risk_factors = Column(Text, nullable=True)
    protective_factors = Column(Text, nullable=True)
    trigger_factors = Column(Text, nullable=True)
    
    suicide_risk = Column(String(50), nullable=True)
    self_harm_risk = Column(String(50), nullable=True)
    violence_risk = Column(String(50), nullable=True)
    
    assessment_notes = Column(Text, nullable=True)
    recommended_actions = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="risk_assessments")


class SupervisionFeedback(Base):
    __tablename__ = "supervision_feedbacks"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    feedback_version = Column(Integer, default=1)
    
    supervisor_id = Column(Integer, ForeignKey("counselors.id"))
    feedback_date = Column(DateTime, default=datetime.utcnow)
    
    overall_assessment = Column(Text, nullable=True)
    strengths = Column(Text, nullable=True)
    areas_for_improvement = Column(Text, nullable=True)
    
    ethical_considerations = Column(Text, nullable=True)
    legal_implications = Column(Text, nullable=True)
    
    specific_recommendations = Column(Text, nullable=True)
    follow_up_requirements = Column(Text, nullable=True)
    
    case_status_recommendation = Column(SQLEnum(CaseStatus), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="supervision_feedbacks")


class CrisisEscalation(Base):
    __tablename__ = "crisis_escalations"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    escalation_number = Column(Integer, default=1)
    
    escalation_date = Column(DateTime, default=datetime.utcnow)
    escalated_by = Column(Integer, ForeignKey("counselors.id"))
    
    trigger_event = Column(Text, nullable=False)
    immediate_actions_taken = Column(Text, nullable=False)
    parties_notified = Column(Text, nullable=True)
    
    crisis_level = Column(String(50), nullable=True)
    safety_plan_activated = Column(Integer, default=0)
    emergency_contacts_informed = Column(Integer, default=0)
    
    follow_up_date = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    is_resolved = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="crisis_escalations")


class StatusTransition(Base):
    __tablename__ = "status_transitions"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    
    from_status = Column(SQLEnum(CaseStatus), nullable=False)
    to_status = Column(SQLEnum(CaseStatus), nullable=False)
    
    transition_date = Column(DateTime, default=datetime.utcnow)
    transitioned_by = Column(Integer, ForeignKey("counselors.id"))
    
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="status_transitions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    counselor_id = Column(Integer, ForeignKey("counselors.id"), nullable=True)
    
    action = Column(String(100), nullable=False)
    action_type = Column(String(50), nullable=False)
    
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(200), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="audit_logs")
