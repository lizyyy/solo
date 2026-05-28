from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class LetterOfCredit(Base):
    __tablename__ = "letters_of_credit"

    id = Column(Integer, primary_key=True, index=True)
    lc_number = Column(String(100), unique=True, index=True, nullable=False)
    issuing_bank = Column(String(200))
    applicant = Column(String(200))
    beneficiary = Column(String(200))
    currency = Column(String(10))
    amount = Column(Float)
    latest_shipment_date = Column(DateTime)
    expiry_date = Column(DateTime)
    clauses_text = Column(Text)
    status = Column(String(50), default="DRAFT")
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="letter_of_credit", cascade="all, delete-orphan")
    clauses = relationship("LcClause", back_populates="letter_of_credit", cascade="all, delete-orphan")
    discrepancies = relationship("Discrepancy", back_populates="letter_of_credit", cascade="all, delete-orphan")
    attachments = relationship("Attachment", primaryjoin="and_(Attachment.related_type=='LC', foreign(Attachment.related_id)==LetterOfCredit.id)", viewonly=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    lc_id = Column(Integer, ForeignKey("letters_of_credit.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    document_number = Column(String(100), nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    content = Column(JSON)
    raw_text = Column(Text)
    remarks = Column(Text)
    submitted_by = Column(String(100))
    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    letter_of_credit = relationship("LetterOfCredit", back_populates="documents")
    discrepancies = relationship("Discrepancy", back_populates="document")
    version_records = relationship("VersionRecord", primaryjoin="and_(VersionRecord.related_type=='DOCUMENT', foreign(VersionRecord.related_id)==Document.id)", viewonly=True)
    attachments = relationship("Attachment", primaryjoin="and_(Attachment.related_type=='DOCUMENT', foreign(Attachment.related_id)==Document.id)", viewonly=True)

    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class LcClause(Base):
    __tablename__ = "lc_clauses"

    id = Column(Integer, primary_key=True, index=True)
    lc_id = Column(Integer, ForeignKey("letters_of_credit.id"), nullable=False)
    clause_number = Column(String(50))
    clause_type = Column(String(50))
    content = Column(Text, nullable=False)
    parsed_fields = Column(JSON)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    letter_of_credit = relationship("LetterOfCredit", back_populates="clauses")


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    lc_id = Column(Integer, ForeignKey("letters_of_credit.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"))
    clause_id = Column(Integer, ForeignKey("lc_clauses.id"))
    discrepancy_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM")
    status = Column(String(50), default="OPEN")
    description = Column(Text, nullable=False)
    reason = Column(Text)
    impact_scope = Column(Text)
    next_action = Column(Text)
    clause_ref = Column(String(100))
    document_ref = Column(String(100))
    correction_note = Column(Text)
    corrected_by = Column(String(100))
    corrected_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    letter_of_credit = relationship("LetterOfCredit", back_populates="discrepancies")
    document = relationship("Document", back_populates="discrepancies")
    version_records = relationship("VersionRecord", primaryjoin="and_(VersionRecord.related_type=='DISCREPANCY', foreign(VersionRecord.related_id)==Discrepancy.id)", viewonly=True)


class VersionRecord(Base):
    __tablename__ = "version_records"

    id = Column(Integer, primary_key=True, index=True)
    related_type = Column(String(50), nullable=False)
    related_id = Column(Integer, nullable=False)
    version = Column(Integer, default=1)
    action = Column(String(50))
    old_content = Column(JSON)
    new_content = Column(JSON)
    change_reason = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    related_type = Column(String(50), nullable=False)
    related_id = Column(Integer, nullable=False)
    file_name = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))
    description = Column(Text)
    uploaded_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
