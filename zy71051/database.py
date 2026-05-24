from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./medicine_box.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Elder(Base):
    __tablename__ = "elders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    id_card = Column(String(18), unique=True, index=True)
    room_number = Column(String(50))
    bed_number = Column(String(50))
    gender = Column(String(10))
    age = Column(Integer)
    contact_person = Column(String(100))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prescriptions = relationship("Prescription", back_populates="elder")
    medicine_boxes = relationship("MedicineBox", back_populates="elder")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    doctor_name = Column(String(100))
    diagnosis = Column(Text)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_active = Column(Boolean, default=True)
    source = Column(String(50))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)

    elder = relationship("Elder", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription")
    stop_requests = relationship("StopRequest", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_name = Column(String(200), nullable=False)
    specification = Column(String(100))
    dosage = Column(String(100))
    frequency = Column(String(100))
    usage = Column(String(100))
    quantity = Column(Float)
    unit = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="items")


class StopRequest(Base):
    __tablename__ = "stop_requests"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    batch_no = Column(String(50), index=True)
    applicant = Column(String(100), nullable=False)
    applicant_role = Column(String(50))
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    effective_date = Column(Date)
    source = Column(String(50))
    is_withdrawn = Column(Boolean, default=False)
    withdrawn_at = Column(DateTime)
    withdrawn_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)

    prescription = relationship("Prescription", back_populates="stop_requests")


class MedicineBox(Base):
    __tablename__ = "medicine_boxes"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    batch_no = Column(String(50), index=True, nullable=False)
    box_no = Column(String(50), index=True)
    distribution_date = Column(Date, nullable=False)
    time_slot = Column(String(20))
    status = Column(String(20), default="pending")
    medicines = Column(Text)
    prepared_by = Column(String(100))
    prepared_at = Column(DateTime)
    signed_by = Column(String(100))
    signed_at = Column(DateTime)
    source = Column(String(50))
    is_supplementary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)

    elder = relationship("Elder", back_populates="medicine_boxes")
    signature = relationship("Signature", uselist=False, back_populates="medicine_box")
    disputes = relationship("Dispute", back_populates="medicine_box")


class Signature(Base):
    __tablename__ = "signatures"

    id = Column(Integer, primary_key=True, index=True)
    medicine_box_id = Column(Integer, ForeignKey("medicine_boxes.id"), nullable=False)
    nurse_name = Column(String(100), nullable=False)
    sign_time = Column(DateTime, default=datetime.utcnow)
    is_backfilled = Column(Boolean, default=False)
    backfill_reason = Column(Text)
    backfilled_by = Column(String(100))
    backfilled_at = Column(DateTime)
    receiver_name = Column(String(100))
    receiver_relation = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    medicine_box = relationship("MedicineBox", back_populates="signature")


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(Integer, primary_key=True, index=True)
    medicine_box_id = Column(Integer, ForeignKey("medicine_boxes.id"), nullable=False)
    reporter = Column(String(100), nullable=False)
    reporter_role = Column(String(50))
    dispute_type = Column(String(50))
    description = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    handler = Column(String(100))
    handle_result = Column(Text)
    handled_at = Column(DateTime)
    before_data = Column(Text)
    after_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medicine_box = relationship("MedicineBox", back_populates="disputes")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    batch_no = Column(String(50), index=True)
    operator = Column(String(100), nullable=False)
    operator_role = Column(String(50))
    source = Column(String(50))
    before_data = Column(Text)
    after_data = Column(Text)
    change_summary = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class BatchUpload(Base):
    __tablename__ = "batch_uploads"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    upload_type = Column(String(50), nullable=False)
    uploader = Column(String(100), nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    is_withdrawn = Column(Boolean, default=False)
    withdrawn_at = Column(DateTime)
    withdrawn_by = Column(String(100))
    withdraw_reason = Column(Text)
    resubmitted_from = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
