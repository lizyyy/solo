from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, foreign
from datetime import datetime

from ..core.database import Base


class AudioTrack(Base):
    __tablename__ = "audio_tracks"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    track_no = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    duration = Column(Float, nullable=False, default=0)
    file_path = Column(String(512))
    file_hash = Column(String(64), unique=True, nullable=False)
    recorded_at = Column(DateTime)
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    ad_scripts = relationship("AdScript", back_populates="audio_track", cascade="all, delete-orphan")
    match_relations = relationship("MatchRelation", back_populates="audio_track")


class AdScript(Base):
    __tablename__ = "ad_scripts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    script_no = Column(String(64), unique=True, nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("audio_tracks.id"), nullable=False)
    track_no = Column(String(64), nullable=False)
    content = Column(Text, nullable=False)
    start_time = Column(Float, nullable=False, default=0)
    end_time = Column(Float, nullable=False, default=0)
    batch_no = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    audio_track = relationship("AudioTrack", back_populates="ad_scripts")
    match_relations = relationship("MatchRelation", back_populates="ad_script")


class SoundMaterial(Base):
    __tablename__ = "sound_materials"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    material_no = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(32), nullable=False, index=True)
    duration = Column(Float, nullable=False, default=0)
    file_path = Column(String(512))
    file_hash = Column(String(64), unique=True, nullable=False)
    tags = Column(Text)
    description = Column(Text)
    status = Column(String(16), nullable=False, default="pending", index=True)
    confidence = Column(Float)
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    match_relations = relationship("MatchRelation", back_populates="sound_material", cascade="all, delete-orphan")
    operation_histories = relationship(
        "OperationHistory",
        primaryjoin="and_(foreign(OperationHistory.target_id) == SoundMaterial.id, "
                    "OperationHistory.target_type == 'sound_material')",
        viewonly=True
    )
    export_items = relationship("ExportItem", back_populates="sound_material")


class MatchRelation(Base):
    __tablename__ = "match_relations"
    __table_args__ = (UniqueConstraint("material_id", "ad_script_id", name="uix_material_ad_script"),)

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    material_id = Column(Integer, ForeignKey("sound_materials.id"), nullable=False, index=True)
    ad_script_id = Column(Integer, ForeignKey("ad_scripts.id"), nullable=False, index=True)
    audio_track_id = Column(Integer, ForeignKey("audio_tracks.id"), nullable=False)
    match_type = Column(String(16), nullable=False, default="auto")
    confidence = Column(Float)
    status = Column(String(16), nullable=False, default="pending", index=True)
    remark = Column(Text)
    created_by = Column(String(64), nullable=False, default="system")
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    sound_material = relationship("SoundMaterial", back_populates="match_relations")
    ad_script = relationship("AdScript", back_populates="match_relations")
    audio_track = relationship("AudioTrack", back_populates="match_relations")
    operation_histories = relationship(
        "OperationHistory",
        primaryjoin="and_(foreign(OperationHistory.target_id) == MatchRelation.id, "
                    "OperationHistory.target_type == 'match_relation')",
        viewonly=True
    )


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    operation_type = Column(String(32), nullable=False, index=True)
    target_type = Column(String(32), nullable=False)
    target_id = Column(Integer, nullable=False, index=True)
    before_data = Column(Text)
    after_data = Column(Text)
    operator = Column(String(64), nullable=False, index=True)
    remark = Column(Text)
    trace_id = Column(String(64), index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    export_no = Column(String(64), unique=True, nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    total_count = Column(Integer, nullable=False, default=0)
    filter_params = Column(Text)
    filter_hash = Column(String(64), nullable=False, index=True)
    exported_by = Column(String(64), nullable=False)
    trace_id = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    export_items = relationship("ExportItem", back_populates="export_record", cascade="all, delete-orphan")


class ExportItem(Base):
    __tablename__ = "export_items"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    export_id = Column(Integer, ForeignKey("export_records.id"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("sound_materials.id"), nullable=False, index=True)
    material_snapshot = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)

    export_record = relationship("ExportRecord", back_populates="export_items")
    sound_material = relationship("SoundMaterial", back_populates="export_items")


class IdempotencyToken(Base):
    __tablename__ = "idempotency_tokens"

    token = Column(String(64), primary_key=True)
    request_hash = Column(String(64), nullable=False)
    response_data = Column(Text)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    batch_no = Column(String(64), unique=True, nullable=False, index=True)
    import_type = Column(String(32), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    total_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)
    error_log = Column(Text)
    status = Column(String(16), nullable=False, default="processing", index=True)
    imported_by = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime)
