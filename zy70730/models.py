from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./metric_guardrail.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class InterceptStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class InterceptRecord(Base):
    __tablename__ = "intercept_records"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String, index=True)
    tag_set = Column(JSON)
    estimated_cardinality = Column(Integer)
    reason = Column(String)
    status = Column(String, default=InterceptStatus.PENDING)
    reviewer = Column(String, nullable=True)
    review_comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class WhitelistTag(Base):
    __tablename__ = "whitelist_tags"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String, index=True)
    tag_key = Column(String)
    allowed_values = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GuardrailReport(Base):
    __tablename__ = "guardrail_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(String, index=True)
    total_intercepted = Column(Integer, default=0)
    total_approved = Column(Integer, default=0)
    total_rejected = Column(Integer, default=0)
    top_metrics = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


class InterceptRecordCreate(BaseModel):
    metric_name: str = Field(..., description="指标名称")
    tag_set: dict = Field(..., description="标签集合")
    estimated_cardinality: int = Field(..., gt=0, description="估算基数")
    reason: str = Field(..., description="申请理由")


class InterceptRecordResponse(BaseModel):
    id: int
    metric_name: str
    tag_set: dict
    estimated_cardinality: int
    reason: str
    status: str
    reviewer: Optional[str]
    review_comment: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        orm_mode = True


class ReviewRequest(BaseModel):
    reviewer: str = Field(..., description="审核人")
    status: InterceptStatus = Field(..., description="审核状态")
    review_comment: Optional[str] = Field(None, description="审核意见")


class WhitelistTagCreate(BaseModel):
    metric_name: str = Field(..., description="指标名称")
    tag_key: str = Field(..., description="标签键")
    allowed_values: Optional[List[str]] = Field(None, description="允许的值列表，None表示全部允许")


class CardinalityEstimateRequest(BaseModel):
    metric_name: str = Field(..., description="指标名称")
    tag_set: dict = Field(..., description="标签集合")


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    INVALID_OPERATION = "invalid_operation"


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
