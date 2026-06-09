from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Index
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import config

Base = declarative_base()


class Pet(Base):
    __tablename__ = "pets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(64), nullable=False, index=True)
    species = Column(String(32))
    breed = Column(String(64))
    gender = Column(String(16))
    birth_date = Column(String(16))
    owner_name = Column(String(64))
    owner_phone = Column(String(32))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    schedules = relationship("WeightSchedule", back_populates="pet", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="pet", cascade="all, delete-orphan")
    reconciliations = relationship("Reconciliation", back_populates="pet", cascade="all, delete-orphan")


class WeightSchedule(Base):
    __tablename__ = "weight_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(String(32), ForeignKey("pets.pet_id"), nullable=False, index=True)
    plan_date = Column(String(16), nullable=False, index=True)
    current_weight_kg = Column(Float, nullable=False)
    target_weight_kg = Column(Float, nullable=False)
    weight_loss_target = Column(Float, nullable=False)
    exercise_plan = Column(Text)
    diet_plan = Column(Text)
    medication_reminder = Column(String(256))
    trainer = Column(String(32))
    status = Column(String(16), default="进行中")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    pet = relationship("Pet", back_populates="schedules")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String(32), unique=True, nullable=False, index=True)
    pet_id = Column(String(32), ForeignKey("pets.pet_id"), index=True)
    handwritten_name = Column(String(64), nullable=False, index=True)
    record_date = Column(String(16), nullable=False, index=True)
    raw_weight = Column(String(64), nullable=False)
    weight_value = Column(Float)
    weight_unit = Column(String(16))
    standard_weight_kg = Column(Float)
    medication_given = Column(String(256))
    medication_remark = Column(String(256))
    medical_summary = Column(Text)
    vet_name = Column(String(32))
    is_name_matched = Column(Boolean, default=False)
    is_weight_unit_standard = Column(Boolean, default=True)
    needs_review = Column(Boolean, default=False)
    review_reason = Column(String(256))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    pet = relationship("Pet", back_populates="medical_records")
    reconciliations = relationship("Reconciliation", back_populates="medical_record", cascade="all, delete-orphan")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(32), nullable=False, index=True)
    pet_id = Column(String(32), ForeignKey("pets.pet_id"), nullable=False, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), index=True)
    schedule_id = Column(Integer)
    pet_name = Column(String(64))
    handwritten_name = Column(String(64))
    name_match_status = Column(String(16), default="未匹配")
    raw_weight = Column(String(64))
    weight_unit = Column(String(16))
    standard_weight_kg = Column(Float)
    weight_unit_status = Column(String(16), default="标准")
    target_weight_kg = Column(Float)
    weight_loss_diff = Column(Float)
    plan_date = Column(String(16))
    record_date = Column(String(16))
    medication_reminder = Column(String(256))
    medical_summary = Column(Text)
    review_status = Column(String(16), default="待复核")
    review_reason = Column(String(256))
    manual_note = Column(Text)
    note_source = Column(String(16), default="无")
    process_status = Column(String(16), default="未处理")
    process_round = Column(Integer, default=1)
    export_timestamp = Column(String(32))
    created_at = Column(DateTime, default=datetime.now, index=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    pet = relationship("Pet", back_populates="reconciliations")
    medical_record = relationship("MedicalRecord", back_populates="reconciliations")

    __table_args__ = (
        Index("idx_batch_pet", "batch_no", "pet_id"),
        Index("idx_review_status", "review_status"),
    )


class ExportBatch(Base):
    __tablename__ = "export_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(32), unique=True, nullable=False, index=True)
    export_timestamp = Column(String(32), nullable=False)
    filter_criteria = Column(Text)
    record_count = Column(Integer, default=0)
    file_name = Column(String(256))
    file_path = Column(String(512))
    created_by = Column(String(32), default="system")
    created_at = Column(DateTime, default=datetime.now)


class ManualNote(Base):
    __tablename__ = "manual_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliations.id"), nullable=False, index=True)
    note_content = Column(Text, nullable=False)
    note_source = Column(String(16), default="人工")
    created_by = Column(String(32), default="阿岑")
    created_at = Column(DateTime, default=datetime.now, index=True)
    is_latest = Column(Boolean, default=True)


class FilterState(Base):
    __tablename__ = "filter_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    state_key = Column(String(64), unique=True, nullable=False, index=True)
    filter_json = Column(Text, nullable=False)
    page = Column(Integer, default=1)
    per_page = Column(Integer, default=20)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


def init_db():
    engine = create_engine(f"sqlite:///{config.DB_PATH}", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def get_engine():
    return create_engine(f"sqlite:///{config.DB_PATH}", echo=False)
