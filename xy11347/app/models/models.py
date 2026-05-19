from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    QC_OPERATOR = "qc_operator"
    WORKSHOP = "workshop"
    VIEWER = "viewer"


class QCStatus(str, enum.Enum):
    PENDING = "pending"
    PASS = "pass"
    FAIL = "fail"
    REWORK = "rework"
    REVIEWING = "reviewing"
    FINAL_PASS = "final_pass"


class ImportSource(str, enum.Enum):
    COLOR_CSV = "color_csv"
    ORDER_JSON = "order_json"
    REWORK_NOTE = "rework_note"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(Enum(UserRole), default=UserRole.QC_OPERATOR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    product_name = Column(String(200), nullable=False)
    customer = Column(String(100))
    paper_batch = Column(String(100), index=True)
    paper_type = Column(String(100))
    quantity = Column(Integer)
    target_l = Column(Float)
    target_a = Column(Float)
    target_b = Column(Float)
    tolerance_l = Column(Float, default=2.0)
    tolerance_a = Column(Float, default=2.0)
    tolerance_b = Column(Float, default=2.0)
    operator = Column(String(50))
    print_date = Column(DateTime)
    status = Column(Enum(QCStatus), default=QCStatus.PENDING)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))

    color_measurements = relationship("ColorMeasurement", back_populates="order")
    rework_records = relationship("ReworkRecord", back_populates="order")
    qc_reports = relationship("QCReport", back_populates="order")


class ColorMeasurement(Base):
    __tablename__ = "color_measurements"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_no = Column(String(50), index=True)
    measurement_no = Column(String(50), index=True)
    measure_point = Column(String(100))
    l_value = Column(Float, nullable=False)
    a_value = Column(Float, nullable=False)
    b_value = Column(Float, nullable=False)
    delta_l = Column(Float)
    delta_a = Column(Float)
    delta_b = Column(Float)
    delta_e = Column(Float)
    paper_batch = Column(String(100), index=True)
    measure_time = Column(DateTime)
    operator = Column(String(50))
    equipment = Column(String(100))
    is_pass = Column(Boolean)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50))

    order = relationship("Order", back_populates="color_measurements")


class ReworkRecord(Base):
    __tablename__ = "rework_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_no = Column(String(50), index=True)
    rework_type = Column(String(100))
    rework_reason = Column(Text, nullable=False)
    rework_count = Column(Integer, default=1)
    operator = Column(String(50))
    rework_date = Column(DateTime)
    before_status = Column(Enum(QCStatus))
    after_status = Column(Enum(QCStatus))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50))

    order = relationship("Order", back_populates="rework_records")


class QCReport(Base):
    __tablename__ = "qc_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_no = Column(String(50), index=True)
    total_measurements = Column(Integer, default=0)
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    pass_rate = Column(Float)
    avg_delta_e = Column(Float)
    max_delta_e = Column(Float)
    min_delta_e = Column(Float)
    rework_count = Column(Integer, default=0)
    conclusion = Column(Enum(QCStatus))
    reviewer = Column(String(50))
    review_date = Column(DateTime)
    review_remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50))

    order = relationship("Order", back_populates="qc_reports")
    review_records = relationship("ReviewRecord", back_populates="qc_report")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    qc_report_id = Column(Integer, ForeignKey("qc_reports.id"))
    reviewer = Column(String(50))
    review_action = Column(String(100))
    review_notes = Column(Text)
    before_status = Column(Enum(QCStatus))
    after_status = Column(Enum(QCStatus))
    review_date = Column(DateTime(timezone=True), server_default=func.now())

    qc_report = relationship("QCReport", back_populates="review_records")


class ImportErrorRecord(Base):
    __tablename__ = "import_error_records"

    id = Column(Integer, primary_key=True, index=True)
    import_source = Column(Enum(ImportSource), nullable=False)
    file_name = Column(String(255))
    row_number = Column(Integer)
    original_data = Column(Text, nullable=False)
    error_type = Column(String(100))
    error_message = Column(Text, nullable=False)
    suggestion = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(50))
    resolved_at = Column(DateTime(timezone=True))
    correction_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50))


class QCRule(Base):
    __tablename__ = "qc_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), unique=True, nullable=False)
    rule_type = Column(String(50))
    description = Column(Text)
    condition_expression = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))
