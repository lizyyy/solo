import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, Text, DateTime, Enum, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship

from .database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.utcnow().isoformat()


class CoordType(str, enum.Enum):
    LATLNG = "latlng"
    METRIC = "metric"
    MIXED = "mixed"


class ReplayStage(str, enum.Enum):
    IMPORTED = "imported"
    ENGINEER_REVIEWED = "engineer_reviewed"
    CREW_BRIEFED = "crew_briefed"


class RangefinderRecord(Base):
    __tablename__ = "rangefinder_records"

    id = Column(String, primary_key=True, default=_uuid)
    batch_id = Column(String, index=True, nullable=False)
    record_hash = Column(String, unique=True, index=True, nullable=False)
    raw_data = Column(Text, nullable=False)
    coord_type = Column(Enum(CoordType), nullable=False)
    lat_value = Column(Float, nullable=True)
    lng_value = Column(Float, nullable=True)
    metric_x = Column(Float, nullable=True)
    metric_y = Column(Float, nullable=True)
    metric_z = Column(Float, nullable=True)
    distance = Column(Float, nullable=True)
    recorded_at = Column(String, nullable=True)
    imported_at = Column(String, default=_now)
    needs_review = Column(Boolean, default=False)


class ObstacleRemark(Base):
    __tablename__ = "obstacle_remarks"

    id = Column(String, primary_key=True, default=_uuid)
    rangefinder_record_id = Column(String, ForeignKey("rangefinder_records.id"), nullable=False)
    author = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)


class RemarkChangeLog(Base):
    __tablename__ = "remark_change_logs"

    id = Column(String, primary_key=True, default=_uuid)
    obstacle_remark_id = Column(String, ForeignKey("obstacle_remarks.id"), nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String, nullable=False)
    changed_at = Column(String, default=_now)
    reason = Column(Text, nullable=True)


class ReplaySnapshot(Base):
    __tablename__ = "replay_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    rangefinder_record_id = Column(String, ForeignKey("rangefinder_records.id"), nullable=False)
    stage = Column(Enum(ReplayStage), nullable=False)
    snapshot_data = Column(JSON, nullable=False)
    model_params_version = Column(String, nullable=True)
    model_params_reason = Column(Text, nullable=True)
    created_at = Column(String, default=_now)


class ReplayReport(Base):
    __tablename__ = "replay_reports"

    id = Column(String, primary_key=True, default=_uuid)
    replay_snapshot_id = Column(String, ForeignKey("replay_snapshots.id"), nullable=False)
    why_kept = Column(Text, nullable=True)
    missing_materials = Column(Text, nullable=True)
    next_step_owner = Column(String, nullable=True)
    next_step_description = Column(Text, nullable=True)
    param_version = Column(String, nullable=True)
    param_tradeoff_reason = Column(Text, nullable=True)
    generated_at = Column(String, default=_now)
