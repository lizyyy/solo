import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    LENS_PREPARING = "lens_preparing"
    LENS_CUTTING = "lens_cutting"
    LENS_POLISHING = "lens_polishing"
    FRAME_FITTING = "frame_fitting"
    QUALITY_CHECK = "quality_check"
    READY_FOR_PICKUP = "ready_for_pickup"
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class PrescriptionType(str, enum.Enum):
    SPHERE = "sphere"
    CYLINDER = "cylinder"
    AXIS = "axis"
    ADD = "add"
    PD = "pd"


class ChangeStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPLIED = "applied"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(100))
    wechat = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    prescriptions = relationship("Prescription", back_populates="customer")
    lens_orders = relationship("LensOrder", back_populates="customer")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    optometrist = Column(String(100))
    exam_date = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True))

    od_sphere = Column(Float, nullable=False)
    od_cylinder = Column(Float, default=0)
    od_axis = Column(Integer, default=0)
    od_add = Column(Float)

    os_sphere = Column(Float, nullable=False)
    os_cylinder = Column(Float, default=0)
    os_axis = Column(Integer, default=0)
    os_add = Column(Float)

    pd_distance = Column(Float)
    pd_near = Column(Float)

    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100))

    customer = relationship("Customer", back_populates="prescriptions")
    lens_orders = relationship("LensOrder", back_populates="prescription")
    change_records = relationship("DegreeChangeRecord", back_populates="prescription", foreign_keys="DegreeChangeRecord.prescription_id")


class LensOrder(Base):
    __tablename__ = "lens_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    frame_id = Column(Integer, ForeignKey("frames.id"))

    lens_type_od = Column(String(100), nullable=False)
    lens_type_os = Column(String(100), nullable=False)
    lens_brand = Column(String(100))
    lens_coating = Column(String(100))

    status = Column(String(50), default=ProcessingStatus.PENDING, nullable=False)
    status_updated_at = Column(DateTime(timezone=True), server_default=func.now())
    status_updated_by = Column(String(100))

    estimated_completion = Column(DateTime(timezone=True))
    pickup_deadline = Column(DateTime(timezone=True))
    pickup_reminder_sent = Column(Boolean, default=False)

    rush_order = Column(Boolean, default=False)
    priority_level = Column(Integer, default=1)

    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100))

    customer = relationship("Customer", back_populates="lens_orders")
    prescription = relationship("Prescription", back_populates="lens_orders")
    frame = relationship("Frame", back_populates="lens_orders")
    change_records = relationship("DegreeChangeRecord", back_populates="lens_order")
    status_history = relationship("ProcessingStatusHistory", back_populates="lens_order")
    pickup_report = relationship("PickupReport", back_populates="lens_order", uselist=False)


class Frame(Base):
    __tablename__ = "frames"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    color = Column(String(50))
    material = Column(String(50))
    size = Column(String(50))
    bridge = Column(String(20))
    temple_length = Column(String(20))

    quantity = Column(Integer, default=0)
    price = Column(Float)
    location = Column(String(100))

    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lens_orders = relationship("LensOrder", back_populates="frame")


class DegreeChangeRecord(Base):
    __tablename__ = "degree_change_records"

    id = Column(Integer, primary_key=True, index=True)
    lens_order_id = Column(Integer, ForeignKey("lens_orders.id"), nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    new_prescription_id = Column(Integer, ForeignKey("prescriptions.id"))

    change_type = Column(String(50), nullable=False)
    original_value = Column(Text)
    new_value = Column(Text)
    reason = Column(Text, nullable=False)

    status = Column(String(50), default=ChangeStatus.PENDING_REVIEW, nullable=False)
    can_apply = Column(Boolean, default=True)
    interception_reason = Column(Text)

    requested_by = Column(String(100), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)

    applied_at = Column(DateTime(timezone=True))
    applied_by = Column(String(100))

    raw_input = Column(Text)
    processing_conclusion = Column(Text)

    lens_order = relationship("LensOrder", back_populates="change_records")
    prescription = relationship("Prescription", back_populates="change_records", foreign_keys="[DegreeChangeRecord.prescription_id]")
    new_prescription = relationship("Prescription", foreign_keys="[DegreeChangeRecord.new_prescription_id]")


class ProcessingStatusHistory(Base):
    __tablename__ = "processing_status_history"

    id = Column(Integer, primary_key=True, index=True)
    lens_order_id = Column(Integer, ForeignKey("lens_orders.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)

    lens_order = relationship("LensOrder", back_populates="status_history")


class PickupReport(Base):
    __tablename__ = "pickup_reports"

    id = Column(Integer, primary_key=True, index=True)
    lens_order_id = Column(Integer, ForeignKey("lens_orders.id"), unique=True, nullable=False)
    report_no = Column(String(50), unique=True, nullable=False)

    final_check_by = Column(String(100))
    final_check_date = Column(DateTime(timezone=True))
    check_notes = Column(Text)

    pickup_ready_date = Column(DateTime(timezone=True))
    first_reminder_sent = Column(Boolean, default=False)
    first_reminder_date = Column(DateTime(timezone=True))
    second_reminder_sent = Column(Boolean, default=False)
    second_reminder_date = Column(DateTime(timezone=True))

    picked_up = Column(Boolean, default=False)
    pickup_date = Column(DateTime(timezone=True))
    picked_up_by = Column(String(100))
    pickup_notes = Column(Text)

    quality_pass = Column(Boolean, default=True)
    defects_found = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lens_order = relationship("LensOrder", back_populates="pickup_report")
