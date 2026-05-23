from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base

class RetestRule(Base):
    __tablename__ = "retest_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String)
    rule_code = Column(String, unique=True)
    rule_type = Column(String)
    description = Column(Text)
    condition_expr = Column(Text)
    action_expr = Column(Text)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    retest_window_days = Column(Integer)
    max_retest_count = Column(Integer, default=1)
    parameter_json = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
