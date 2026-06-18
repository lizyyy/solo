import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship

from app.database import Base


class RecordStatus(str, enum.Enum):
    PENDING = "pending"
    CALCULATING = "calculating"
    SUCCESS = "success"
    FAILED_FORMULA = "failed_formula"
    FAILED_UNIT = "failed_unit"
    FAILED_THRESHOLD = "failed_threshold"
    SUSPENDED_CLOUD = "suspended_cloud"
    SUPPLEMENTED = "supplemented"


class CoordinateFormat(str, enum.Enum):
    DECIMAL = "decimal"
    DMS = "dms"
    UNKNOWN = "unknown"


class SiltationRecord(Base):
    __tablename__ = "siltation_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String, unique=True, index=True, nullable=False)
    harbor_name = Column(String, index=True)
    original_name = Column(String, nullable=True)
    name_changed = Column(Boolean, default=False)

    raw_latitude = Column(String)
    raw_longitude = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    coord_format_detected = Column(Enum(CoordinateFormat), default=CoordinateFormat.UNKNOWN)
    coord_normalized = Column(Boolean, default=False)

    raw_siltation_value = Column(Float, nullable=True)
    raw_unit = Column(String, nullable=True)
    siltation_cm = Column(Float, nullable=True)

    formula_version = Column(String, nullable=True)
    status = Column(Enum(RecordStatus), default=RecordStatus.PENDING)
    fail_reason = Column(Text, nullable=True)
    fail_stage = Column(String, nullable=True)

    judgment_before = Column(String, nullable=True)
    judgment_after = Column(String, nullable=True)
    judgment_changed = Column(Boolean, default=False)

    is_supplemented = Column(Boolean, default=False)
    supplement_count = Column(Integer, default=0)

    gray_release_note = Column(Text, nullable=True)
    post_run_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    images = relationship("RemoteSensingImage", back_populates="record")
    supplements = relationship("SupplementNote", back_populates="record")
    rejudge_logs = relationship("RejudgeLog", back_populates="record")
    exports = relationship("ExportRecord", back_populates="record")


class RemoteSensingImage(Base):
    __tablename__ = "remote_sensing_images"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("siltation_records.id"))
    image_path = Column(String)
    capture_time = Column(DateTime, nullable=True)
    has_cloud_cover = Column(Boolean, default=False)
    cloud_cover_ratio = Column(Float, default=0.0)
    raw_latitude = Column(String, nullable=True)
    raw_longitude = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    coord_format_detected = Column(Enum(CoordinateFormat), default=CoordinateFormat.UNKNOWN)
    coord_normalized = Column(Boolean, default=False)
    remark = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("SiltationRecord", back_populates="images")


class SupplementNote(Base):
    __tablename__ = "supplement_notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("siltation_records.id"))
    note_type = Column(String)
    content = Column(Text)
    operator = Column(String, nullable=True)
    affected_judgments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("SiltationRecord", back_populates="supplements")


class RejudgeLog(Base):
    __tablename__ = "rejudge_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("siltation_records.id"))
    before_judgment = Column(String, nullable=True)
    after_judgment = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    triggered_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("SiltationRecord", back_populates="rejudge_logs")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("siltation_records.id"))
    export_batch_no = Column(String, index=True)
    export_version = Column(Integer, default=1)
    field_name = Column(String)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("SiltationRecord", back_populates="exports")
