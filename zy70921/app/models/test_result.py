from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"))
    sample_code = Column(String, index=True)
    batch_no = Column(String, index=True)
    report_no = Column(String, unique=True, index=True)
    status = Column(String)
    result_type = Column(String)
    operator = Column(String)
    result_summary = Column(Text)
    original_data = Column(Text)
    failed_reason = Column(Text)
    suggestion = Column(Text)
    rule_triggered = Column(Boolean, default=False)
    retest_count = Column(Integer, default=0)
    is_retest = Column(Boolean, default=False)
    is_issued = Column(Boolean, default=False)
    issued_at = Column(DateTime)
    is_withdrawn = Column(Boolean, default=False)
    withdrawn_at = Column(DateTime)
    withdraw_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sample = relationship("Sample", back_populates="test_results")
