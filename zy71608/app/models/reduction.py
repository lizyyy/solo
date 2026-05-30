from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import BaseModel
from app.models.enums import ApplicationStatus


class ReductionApplication(Base, BaseModel):
    __tablename__ = "reduction_applications"

    application_no = Column(String(50), index=True, nullable=False, unique=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    tenant_name = Column(String(100), index=True, nullable=False)
    store_code = Column(String(50), index=True)
    reduction_reason = Column(String(200), nullable=False)
    reduction_type = Column(String(50), default="租金减免")
    closure_start_date = Column(Date, nullable=False)
    closure_end_date = Column(Date, nullable=False)
    applied_days = Column(Integer, nullable=False)
    approved_days = Column(Integer)
    reduction_start_date = Column(Date)
    reduction_end_date = Column(Date)
    reduction_ratio = Column(Numeric(5, 4), default=1.0)
    monthly_rent_standard = Column(Numeric(15, 2))
    monthly_service_fee_standard = Column(Numeric(15, 2), default=0)
    calculated_rent_reduction = Column(Numeric(15, 2), default=0)
    calculated_service_fee_reduction = Column(Numeric(15, 2), default=0)
    total_reduction_amount = Column(Numeric(15, 2), default=0)
    has_anomaly = Column(Boolean, default=False)
    anomaly_description = Column(Text)
    status = Column(String(30), default=ApplicationStatus.DRAFT.value)
    current_step = Column(String(50), default="合同版本校验")
    trial_calc_result = Column(Text)
    review_comments = Column(Text)
    approval_comments = Column(Text)
    manual_override = Column(Boolean, default=False)
    manual_override_reason = Column(Text)
    manual_override_by = Column(String(50))
    remarks = Column(Text)

    contract = relationship("Contract", back_populates="reductions")
    closure_proofs = relationship("StoreClosureProof", back_populates="application")
    approvals = relationship("ApprovalRecord", back_populates="application")
    anomalies = relationship("AnomalyFlag", back_populates="application")
    calculations = relationship("ReductionCalculation", back_populates="application")
    supplementary_agreements = relationship("SupplementaryAgreement", back_populates="application")
    audit_logs = relationship("AuditLog", back_populates="application")


class StoreClosureProof(Base, BaseModel):
    __tablename__ = "store_closure_proofs"

    application_id = Column(Integer, ForeignKey("reduction_applications.id"), nullable=False)
    proof_no = Column(String(50))
    closure_reason = Column(String(200))
    actual_closure_date = Column(Date)
    actual_reopen_date = Column(Date)
    actual_closure_days = Column(Integer)
    supporting_docs = Column(String(500))
    verified_by = Column(String(50))
    verification_date = Column(Date)
    verification_status = Column(String(20), default="未核实")
    remarks = Column(Text)

    application = relationship("ReductionApplication", back_populates="closure_proofs")


class SupplementaryAgreement(Base, BaseModel):
    __tablename__ = "supplementary_agreements"

    agreement_no = Column(String(50), index=True, nullable=False, unique=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("reduction_applications.id"))
    version = Column(Integer, default=1)
    sign_date = Column(Date)
    effective_date = Column(Date)
    reduction_amount = Column(Numeric(15, 2), default=0)
    reduction_days = Column(Integer)
    payment_method = Column(String(100))
    signed_by_party_a = Column(String(50))
    signed_by_party_b = Column(String(50))
    status = Column(String(20), default="草稿")
    remarks = Column(Text)

    contract = relationship("Contract", back_populates="supplementary_agreements")
    application = relationship("ReductionApplication", back_populates="supplementary_agreements")
