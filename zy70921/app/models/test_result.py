from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base

class TestResult(Base):
    __tablename__ = 'test_results'

    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String, index=True)
    report_no = Column(String, unique=True, index=True)
    status = Column(String)
    operator = Column(String)
    result_summary = Column(Text)
    is_issued = Column(Boolean, default=False)
    issued_at = Column(DateTime)
    is_withdrawn = Column(Boolean, default=False)
    withdrawn_at = Column(DateTime)
    withdraw_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
