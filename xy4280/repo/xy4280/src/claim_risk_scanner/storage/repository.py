import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from enum import Enum

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Text,
    ForeignKey, Index, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship


Base = declarative_base()


class ReviewStatus(Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    ESCALATED = "escalated"


class RiskLevelDB(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InvoiceModel(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(100), unique=True, nullable=False, index=True)
    invoice_date = Column(String(20))
    vendor_name = Column(String(200), index=True)
    vendor_tax_id = Column(String(50), index=True)
    total_amount = Column(Float, nullable=False)
    tax_amount = Column(Float, default=0.0)
    buyer_name = Column(String(200))
    buyer_tax_id = Column(String(50))
    ocr_confidence = Column(Float)
    raw_json = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    claims = relationship("ClaimModel", back_populates="invoice")
    reviews = relationship("ReviewModel", back_populates="invoice")
    
    __table_args__ = (
        Index('idx_invoice_vendor', 'vendor_name', 'vendor_tax_id'),
        Index('idx_invoice_amount', 'total_amount'),
    )


class ClaimModel(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_id = Column(String(100), unique=True, nullable=False, index=True)
    policy_number = Column(String(100))
    claimant_name = Column(String(200))
    claim_date = Column(String(20))
    claim_amount = Column(Float)
    invoice_number = Column(String(100), ForeignKey('invoices.invoice_number'), index=True)
    diagnosis = Column(String(500))
    hospital_name = Column(String(200))
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    invoice = relationship("InvoiceModel", back_populates="claims")


class RiskSampleModel(Base):
    __tablename__ = "risk_samples"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_name = Column(String(200), nullable=False, index=True)
    vendor_tax_id = Column(String(50), index=True)
    risk_level = Column(SQLEnum(RiskLevelDB), default=RiskLevelDB.MEDIUM)
    risk_type = Column(String(100))
    sample_count = Column(Integer, default=1)
    last_occurrence = Column(String(20))
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    __table_args__ = (
        Index('idx_risk_vendor', 'vendor_name', 'vendor_tax_id'),
    )


class ReviewModel(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(100), ForeignKey('invoices.invoice_number'), nullable=False, index=True)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(SQLEnum(RiskLevelDB), nullable=False)
    status = Column(SQLEnum(ReviewStatus), default=ReviewStatus.PENDING)
    reviewer_notes = Column(Text)
    reviewer_id = Column(String(100))
    features = Column(Text)
    rule_matches = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    reviewed_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    invoice = relationship("InvoiceModel", back_populates="reviews")
    
    __table_args__ = (
        Index('idx_review_risk', 'risk_level', 'risk_score'),
        Index('idx_review_status', 'status'),
    )


@dataclass
class InvoiceRecord:
    invoice_number: str
    invoice_date: str = ""
    vendor_name: str = ""
    vendor_tax_id: str = ""
    total_amount: float = 0.0
    tax_amount: float = 0.0
    buyer_name: Optional[str] = None
    buyer_tax_id: Optional[str] = None
    ocr_confidence: Optional[float] = None
    raw_json: Dict[str, Any] = field(default_factory=dict)
    
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ClaimRecord:
    claim_id: str
    policy_number: str = ""
    claimant_name: str = ""
    claim_date: str = ""
    claim_amount: float = 0.0
    invoice_number: Optional[str] = None
    diagnosis: Optional[str] = None
    hospital_name: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    id: Optional[int] = None
    created_at: Optional[datetime] = None


@dataclass
class RiskSampleRecord:
    vendor_name: str
    vendor_tax_id: Optional[str] = None
    risk_level: str = "medium"
    risk_type: str = "unknown"
    sample_count: int = 1
    last_occurrence: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ReviewRecord:
    invoice_number: str
    risk_score: float
    risk_level: str
    status: str = "pending"
    reviewer_notes: Optional[str] = None
    reviewer_id: Optional[str] = None
    features: Dict[str, Any] = field(default_factory=dict)
    rule_matches: List[Dict[str, Any]] = field(default_factory=list)
    
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Repository:
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            db_path = Path("data") / "claim_risk.db"
        
        db_path = Path(db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def _get_session(self) -> Session:
        return self.Session()
    
    def add_invoice(self, invoice: InvoiceRecord) -> int:
        session = self._get_session()
        try:
            existing = session.query(InvoiceModel).filter(
                InvoiceModel.invoice_number == invoice.invoice_number
            ).first()
            
            if existing:
                existing.invoice_date = invoice.invoice_date
                existing.vendor_name = invoice.vendor_name
                existing.vendor_tax_id = invoice.vendor_tax_id
                existing.total_amount = invoice.total_amount
                existing.tax_amount = invoice.tax_amount
                existing.buyer_name = invoice.buyer_name
                existing.buyer_tax_id = invoice.buyer_tax_id
                existing.ocr_confidence = invoice.ocr_confidence
                existing.raw_json = json.dumps(invoice.raw_json, ensure_ascii=False)
                session.commit()
                return existing.id
            else:
                model = InvoiceModel(
                    invoice_number=invoice.invoice_number,
                    invoice_date=invoice.invoice_date,
                    vendor_name=invoice.vendor_name,
                    vendor_tax_id=invoice.vendor_tax_id,
                    total_amount=invoice.total_amount,
                    tax_amount=invoice.tax_amount,
                    buyer_name=invoice.buyer_name,
                    buyer_tax_id=invoice.buyer_tax_id,
                    ocr_confidence=invoice.ocr_confidence,
                    raw_json=json.dumps(invoice.raw_json, ensure_ascii=False)
                )
                session.add(model)
                session.commit()
                return model.id
        finally:
            session.close()
    
    def add_invoices_batch(self, invoices: List[InvoiceRecord]) -> int:
        count = 0
        for invoice in invoices:
            self.add_invoice(invoice)
            count += 1
        return count
    
    def get_invoice(self, invoice_number: str) -> Optional[InvoiceRecord]:
        session = self._get_session()
        try:
            model = session.query(InvoiceModel).filter(
                InvoiceModel.invoice_number == invoice_number
            ).first()
            
            if model:
                return self._model_to_invoice_record(model)
            return None
        finally:
            session.close()
    
    def get_all_invoices(self) -> List[InvoiceRecord]:
        session = self._get_session()
        try:
            models = session.query(InvoiceModel).all()
            return [self._model_to_invoice_record(m) for m in models]
        finally:
            session.close()
    
    def _model_to_invoice_record(self, model: InvoiceModel) -> InvoiceRecord:
        return InvoiceRecord(
            id=model.id,
            invoice_number=model.invoice_number,
            invoice_date=model.invoice_date or "",
            vendor_name=model.vendor_name or "",
            vendor_tax_id=model.vendor_tax_id or "",
            total_amount=model.total_amount,
            tax_amount=model.tax_amount,
            buyer_name=model.buyer_name,
            buyer_tax_id=model.buyer_tax_id,
            ocr_confidence=model.ocr_confidence,
            raw_json=json.loads(model.raw_json) if model.raw_json else {},
            created_at=model.created_at,
            updated_at=model.updated_at
        )
    
    def add_claim(self, claim: ClaimRecord) -> int:
        session = self._get_session()
        try:
            existing = session.query(ClaimModel).filter(
                ClaimModel.claim_id == claim.claim_id
            ).first()
            
            if existing:
                existing.policy_number = claim.policy_number
                existing.claimant_name = claim.claimant_name
                existing.claim_date = claim.claim_date
                existing.claim_amount = claim.claim_amount
                existing.invoice_number = claim.invoice_number
                existing.diagnosis = claim.diagnosis
                existing.hospital_name = claim.hospital_name
                existing.raw_data = json.dumps(claim.raw_data, ensure_ascii=False)
                session.commit()
                return existing.id
            else:
                model = ClaimModel(
                    claim_id=claim.claim_id,
                    policy_number=claim.policy_number,
                    claimant_name=claim.claimant_name,
                    claim_date=claim.claim_date,
                    claim_amount=claim.claim_amount,
                    invoice_number=claim.invoice_number,
                    diagnosis=claim.diagnosis,
                    hospital_name=claim.hospital_name,
                    raw_data=json.dumps(claim.raw_data, ensure_ascii=False)
                )
                session.add(model)
                session.commit()
                return model.id
        finally:
            session.close()
    
    def add_claims_batch(self, claims: List[ClaimRecord]) -> int:
        count = 0
        for claim in claims:
            self.add_claim(claim)
            count += 1
        return count
    
    def get_all_claims(self) -> List[ClaimRecord]:
        session = self._get_session()
        try:
            models = session.query(ClaimModel).all()
            return [self._model_to_claim_record(m) for m in models]
        finally:
            session.close()
    
    def _model_to_claim_record(self, model: ClaimModel) -> ClaimRecord:
        return ClaimRecord(
            id=model.id,
            claim_id=model.claim_id,
            policy_number=model.policy_number or "",
            claimant_name=model.claimant_name or "",
            claim_date=model.claim_date or "",
            claim_amount=model.claim_amount or 0.0,
            invoice_number=model.invoice_number,
            diagnosis=model.diagnosis,
            hospital_name=model.hospital_name,
            raw_data=json.loads(model.raw_data) if model.raw_data else {},
            created_at=model.created_at
        )
    
    def add_risk_sample(self, sample: RiskSampleRecord) -> int:
        session = self._get_session()
        try:
            existing = session.query(RiskSampleModel).filter(
                RiskSampleModel.vendor_name == sample.vendor_name
            ).first()
            
            risk_level = RiskLevelDB[sample.risk_level.upper()]
            
            if existing:
                existing.vendor_tax_id = sample.vendor_tax_id
                existing.risk_level = risk_level
                existing.risk_type = sample.risk_type
                existing.sample_count = sample.sample_count
                existing.last_occurrence = sample.last_occurrence
                existing.raw_data = json.dumps(sample.raw_data, ensure_ascii=False)
                session.commit()
                return existing.id
            else:
                model = RiskSampleModel(
                    vendor_name=sample.vendor_name,
                    vendor_tax_id=sample.vendor_tax_id,
                    risk_level=risk_level,
                    risk_type=sample.risk_type,
                    sample_count=sample.sample_count,
                    last_occurrence=sample.last_occurrence,
                    raw_data=json.dumps(sample.raw_data, ensure_ascii=False)
                )
                session.add(model)
                session.commit()
                return model.id
        finally:
            session.close()
    
    def add_risk_samples_batch(self, samples: List[RiskSampleRecord]) -> int:
        count = 0
        for sample in samples:
            self.add_risk_sample(sample)
            count += 1
        return count
    
    def get_all_risk_samples(self) -> List[RiskSampleRecord]:
        session = self._get_session()
        try:
            models = session.query(RiskSampleModel).all()
            return [self._model_to_risk_sample_record(m) for m in models]
        finally:
            session.close()
    
    def _model_to_risk_sample_record(self, model: RiskSampleModel) -> RiskSampleRecord:
        return RiskSampleRecord(
            id=model.id,
            vendor_name=model.vendor_name,
            vendor_tax_id=model.vendor_tax_id,
            risk_level=model.risk_level.value if model.risk_level else "medium",
            risk_type=model.risk_type or "unknown",
            sample_count=model.sample_count or 1,
            last_occurrence=model.last_occurrence,
            raw_data=json.loads(model.raw_data) if model.raw_data else {},
            created_at=model.created_at,
            updated_at=model.updated_at
        )
    
    def add_review(self, review: ReviewRecord) -> int:
        session = self._get_session()
        try:
            existing = session.query(ReviewModel).filter(
                ReviewModel.invoice_number == review.invoice_number
            ).first()
            
            risk_level = RiskLevelDB[review.risk_level.upper()]
            status = ReviewStatus[review.status.upper()]
            
            if existing:
                existing.risk_score = review.risk_score
                existing.risk_level = risk_level
                existing.status = status
                existing.reviewer_notes = review.reviewer_notes
                existing.reviewer_id = review.reviewer_id
                existing.features = json.dumps(review.features, ensure_ascii=False)
                existing.rule_matches = json.dumps(review.rule_matches, ensure_ascii=False)
                session.commit()
                return existing.id
            else:
                model = ReviewModel(
                    invoice_number=review.invoice_number,
                    risk_score=review.risk_score,
                    risk_level=risk_level,
                    status=status,
                    reviewer_notes=review.reviewer_notes,
                    reviewer_id=review.reviewer_id,
                    features=json.dumps(review.features, ensure_ascii=False),
                    rule_matches=json.dumps(review.rule_matches, ensure_ascii=False)
                )
                session.add(model)
                session.commit()
                return model.id
        finally:
            session.close()
    
    def update_review_status(
        self, 
        invoice_number: str, 
        status: str,
        reviewer_notes: Optional[str] = None,
        reviewer_id: Optional[str] = None
    ) -> bool:
        session = self._get_session()
        try:
            review = session.query(ReviewModel).filter(
                ReviewModel.invoice_number == invoice_number
            ).first()
            
            if review:
                review.status = ReviewStatus[status.upper()]
                if reviewer_notes:
                    review.reviewer_notes = reviewer_notes
                if reviewer_id:
                    review.reviewer_id = reviewer_id
                review.reviewed_at = datetime.now()
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def get_review(self, invoice_number: str) -> Optional[ReviewRecord]:
        session = self._get_session()
        try:
            model = session.query(ReviewModel).filter(
                ReviewModel.invoice_number == invoice_number
            ).first()
            
            if model:
                return self._model_to_review_record(model)
            return None
        finally:
            session.close()
    
    def get_reviews_by_risk_level(self, risk_level: str) -> List[ReviewRecord]:
        session = self._get_session()
        try:
            models = session.query(ReviewModel).filter(
                ReviewModel.risk_level == RiskLevelDB[risk_level.upper()]
            ).order_by(ReviewModel.risk_score.desc()).all()
            return [self._model_to_review_record(m) for m in models]
        finally:
            session.close()
    
    def get_reviews_by_status(self, status: str) -> List[ReviewRecord]:
        session = self._get_session()
        try:
            models = session.query(ReviewModel).filter(
                ReviewModel.status == ReviewStatus[status.upper()]
            ).order_by(ReviewModel.risk_score.desc()).all()
            return [self._model_to_review_record(m) for m in models]
        finally:
            session.close()
    
    def get_high_risk_reviews(self, min_score: float = 0.5) -> List[ReviewRecord]:
        session = self._get_session()
        try:
            models = session.query(ReviewModel).filter(
                ReviewModel.risk_score >= min_score
            ).order_by(ReviewModel.risk_score.desc()).all()
            return [self._model_to_review_record(m) for m in models]
        finally:
            session.close()
    
    def _model_to_review_record(self, model: ReviewModel) -> ReviewRecord:
        return ReviewRecord(
            id=model.id,
            invoice_number=model.invoice_number,
            risk_score=model.risk_score,
            risk_level=model.risk_level.value if model.risk_level else "medium",
            status=model.status.value if model.status else "pending",
            reviewer_notes=model.reviewer_notes,
            reviewer_id=model.reviewer_id,
            features=json.loads(model.features) if model.features else {},
            rule_matches=json.loads(model.rule_matches) if model.rule_matches else [],
            created_at=model.created_at,
            reviewed_at=model.reviewed_at,
            updated_at=model.updated_at
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        session = self._get_session()
        try:
            invoice_count = session.query(InvoiceModel).count()
            claim_count = session.query(ClaimModel).count()
            sample_count = session.query(RiskSampleModel).count()
            
            risk_counts = {}
            for level in RiskLevelDB:
                count = session.query(ReviewModel).filter(
                    ReviewModel.risk_level == level
                ).count()
                risk_counts[level.value] = count
            
            status_counts = {}
            for status in ReviewStatus:
                count = session.query(ReviewModel).filter(
                    ReviewModel.status == status
                ).count()
                status_counts[status.value] = count
            
            high_risk_count = session.query(ReviewModel).filter(
                ReviewModel.risk_score >= 0.7
            ).count()
            
            return {
                "invoices": invoice_count,
                "claims": claim_count,
                "risk_samples": sample_count,
                "risk_distribution": risk_counts,
                "status_distribution": status_counts,
                "high_risk_count": high_risk_count,
            }
        finally:
            session.close()
