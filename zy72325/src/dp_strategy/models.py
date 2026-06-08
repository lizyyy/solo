from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    Boolean,
    ForeignKey,
    JSON,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


FIELD_ALIASES = {
    "sku_code": ["SKU编码", "sku_code", "SKUCode", "SKU", "商品编码", "物料编码"],
    "product_name": ["商品名称", "product_name", "ProductName", "品名", "商品名", "物料名称"],
    "formula_expression": ["公式表达式", "formula_expression", "Formula", "公式", "表达式", "计算规则"],
    "denominator_value": ["分母", "denominator_value", "Denominator", "除数", "分母值"],
    "numerator_value": ["分子", "numerator_value", "Numerator", "被除数", "分子值"],
    "result_value": ["结果", "result_value", "Result", "计算结果", "值", "输出结果"],
}


class RecordStatus(str, Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLBACKED = "rollbacked"
    ABNORMAL = "abnormal"


class ChangeType(str, Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    AUTO_CORRECT = "auto_correct"
    ROLLBACK = "rollback"
    TEACHER_COMMENT = "teacher_comment"
    DEMO_UPDATE = "demo_update"
    REVIEW_ACTION = "review_action"


class AbnormalType(str, Enum):
    ZERO_DENOMINATOR = "zero_denominator"
    EMPTY_STRING = "empty_string"
    NULL_VALUE = "null_value"
    INCONSISTENT = "inconsistent"
    OUTLIER = "outlier"
    ZERO_DENOMINATOR_EMPTY_RESULT = "zero_denominator_empty_result"


class ReviewDecision(str, Enum):
    APPROVE_AS_IS = "approve_as_is"
    APPROVE_WITH_CORRECTION = "approve_with_correction"
    REJECT_NEED_REWORK = "reject_need_rework"
    ESCALATE = "escalate"


class FormulaScreenshot(Base):
    __tablename__ = "formula_screenshots"

    id = Column(Integer, primary_key=True)
    batch_id = Column(String(64), index=True, nullable=False)
    original_row_number = Column(Integer, nullable=False)
    source_file = Column(String(255), nullable=False)
    source_format = Column(String(16), default="csv")
    import_time = Column(DateTime, default=datetime.now)
    imported_by = Column(String(64), default="system")

    sku_code = Column(String(64))
    product_name = Column(String(255))
    formula_expression = Column(Text)
    denominator_value = Column(Float)
    numerator_value = Column(Float)
    result_value = Column(String(64))
    original_result = Column(String(64))

    status = Column(String(32), default=RecordStatus.PENDING.value)
    abnormal_type = Column(String(64))
    abnormal_note = Column(Text)
    boundary_rules_triggered = Column(JSON)

    original_statement = Column(Text)
    corrected_value = Column(String(64))
    review_reason = Column(Text)
    next_handler = Column(String(64))

    reviewed_by = Column(String(64))
    reviewed_at = Column(DateTime)
    review_decision = Column(String(64))
    review_decision_detail = Column(Text)

    current_version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True)

    history = relationship("FormulaHistory", back_populates="screenshot", order_by="FormulaHistory.version")
    reviews = relationship("ReviewRecord", back_populates="screenshot")


class FormulaHistory(Base):
    __tablename__ = "formula_history"

    id = Column(Integer, primary_key=True)
    screenshot_id = Column(Integer, ForeignKey("formula_screenshots.id"))
    version = Column(Integer, nullable=False)
    change_type = Column(String(32), nullable=False)
    change_time = Column(DateTime, default=datetime.now)
    changed_by = Column(String(64), default="system")
    change_reason = Column(Text)

    before_data = Column(JSON)
    after_data = Column(JSON)
    diff_fields = Column(JSON)

    screenshot = relationship("FormulaScreenshot", back_populates="history")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True)
    screenshot_id = Column(Integer, ForeignKey("formula_screenshots.id"))
    reviewer = Column(String(64), nullable=False)
    review_time = Column(DateTime, default=datetime.now)
    review_comment = Column(Text)
    review_decision = Column(String(32))

    original_statement = Column(Text)
    corrected_value = Column(String(64))
    review_reason = Column(Text)
    next_handler = Column(String(64))

    screenshot = relationship("FormulaScreenshot", back_populates="reviews")


class BatchImport(Base):
    __tablename__ = "batch_imports"

    id = Column(Integer, primary_key=True)
    batch_id = Column(String(64), unique=True, index=True, nullable=False)
    source_file = Column(String(255), nullable=False)
    source_format = Column(String(16), default="csv")
    file_hash = Column(String(64), nullable=False)
    import_time = Column(DateTime, default=datetime.now)
    imported_by = Column(String(64))
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    abnormal_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    reviewing_count = Column(Integer, default=0)
    approved_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    rollbacked_count = Column(Integer, default=0)
    is_rollbacked = Column(Boolean, default=False)
    rollback_time = Column(DateTime)
    rollback_note = Column(Text)


class BoundaryRule(Base):
    __tablename__ = "boundary_rules"

    id = Column(Integer, primary_key=True)
    rule_name = Column(String(64), unique=True, nullable=False)
    rule_type = Column(String(32), nullable=False)
    condition = Column(JSON, nullable=False)
    action = Column(JSON, nullable=False)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    description = Column(Text)


def init_db(db_path: Optional[str] = None):
    import os
    os.makedirs("data/processed", exist_ok=True)
    if db_path is None:
        db_path = os.environ.get("DP_STRATEGY_DB", "sqlite:///data/processed/dp_strategy.db")
    engine = create_engine(db_path)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


SessionLocal = init_db()
