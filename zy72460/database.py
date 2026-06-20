import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean, DateTime,
    Text, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "rain_garden.db")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DBReviewSession(Base):
    __tablename__ = "review_sessions"

    session_id = Column(String, primary_key=True, index=True)
    task_name = Column(String, default="雨水花园积水复核")
    created_at = Column(DateTime, default=datetime.now)
    current_step = Column(Integer, default=1)

    points = relationship("DBInspectionPoint", back_populates="session")
    records = relationship("DBInspectionRecord", back_populates="session")
    crack_records = relationship("DBCrackRecord", back_populates="session")
    conflicts = relationship("DBConflictItem", back_populates="session")
    exports = relationship("DBMapExport", back_populates="session")
    audit_log = relationship("DBAuditEntry", back_populates="session")
    import_batches = relationship("DBImportBatch", back_populates="session")
    self_checks = relationship("DBSelfCheckResult", back_populates="session")


class DBInspectionPoint(Base):
    __tablename__ = "inspection_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    point_id = Column(String, index=True)
    name = Column(String)
    point_type = Column(String, default="雨水花园")
    lat = Column(Float)
    lng = Column(Float)
    street = Column(String)
    is_boundary = Column(Boolean, default=False)
    adjacent_streets = Column(JSON, default=list)

    session = relationship("DBReviewSession", back_populates="points")


class DBInspectionRecord(Base):
    __tablename__ = "inspection_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    record_id = Column(String, index=True)
    point_id = Column(String, index=True)
    source = Column(String)
    inspector = Column(String)
    inspect_time = Column(DateTime)
    has_waterlogging = Column(Boolean)
    water_depth_cm = Column(Float, nullable=True)
    ramp_accessible = Column(Boolean, nullable=True)
    ramp_note = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    is_supplementary = Column(Boolean, default=False)
    import_batch_id = Column(String, nullable=True)

    session = relationship("DBReviewSession", back_populates="records")


class DBCrackRecord(Base):
    __tablename__ = "crack_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    crack_id = Column(String, index=True)
    point_id = Column(String, index=True)
    inspector = Column(String)
    inspect_time = Column(DateTime)
    has_crack = Column(Boolean)
    crack_description = Column(Text, nullable=True)
    crack_width_mm = Column(Float, nullable=True)
    missing_3d_coords = Column(Boolean, default=False)
    x_coord = Column(Float, nullable=True)
    y_coord = Column(Float, nullable=True)
    z_coord = Column(Float, nullable=True)
    remarks = Column(Text, nullable=True)
    import_time = Column(DateTime, default=datetime.now)
    import_batch_id = Column(String, nullable=True)

    session = relationship("DBReviewSession", back_populates="crack_records")


class DBConflictItem(Base):
    __tablename__ = "conflict_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    conflict_id = Column(String, index=True)
    point_id = Column(String, index=True)
    field_name = Column(String)
    ramp_record_value = Column(JSON)
    night_sampling_value = Column(JSON)
    ramp_record_id = Column(String)
    night_sampling_id = Column(String)
    resolution = Column(String, default="待确认")
    resolved_by = Column(String, nullable=True)
    resolved_time = Column(DateTime, nullable=True)

    session = relationship("DBReviewSession", back_populates="conflicts")


class DBMapExport(Base):
    __tablename__ = "map_exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    export_id = Column(String, index=True)
    export_time = Column(DateTime, default=datetime.now)
    exported_by = Column(String)
    point_count = Column(Integer)
    boundary_points = Column(JSON, default=list)
    conflict_points = Column(JSON, default=list)
    file_hash = Column(String)
    file_path = Column(String, nullable=True)
    file_path_txt = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    file_url_txt = Column(String, nullable=True)
    records_snapshot = Column(JSON, default=list)
    conflicts_snapshot = Column(JSON, default=list)
    audit_snapshot = Column(JSON, default=list)

    session = relationship("DBReviewSession", back_populates="exports")


class DBAuditEntry(Base):
    __tablename__ = "audit_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    audit_id = Column(String, index=True)
    action_type = Column(String)
    actor = Column(String)
    timestamp = Column(DateTime, default=datetime.now)
    description = Column(Text)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    related_record_ids = Column(JSON, default=list)
    related_conflict_ids = Column(JSON, default=list)
    related_export_id = Column(String, nullable=True)

    session = relationship("DBReviewSession", back_populates="audit_log")


class DBImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    batch_id = Column(String, index=True)
    source = Column(String)
    imported_by = Column(String)
    import_time = Column(DateTime, default=datetime.now)
    is_supplementary = Column(Boolean, default=False)
    new_count = Column(Integer, default=0)
    reused_count = Column(Integer, default=0)
    details = Column(JSON, default=list)

    session = relationship("DBReviewSession", back_populates="import_batches")


class DBSelfCheckResult(Base):
    __tablename__ = "self_check_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("review_sessions.session_id"))
    check_name = Column(String)
    passed = Column(Boolean)
    message = Column(Text)
    details = Column(JSON, default=dict)

    session = relationship("DBReviewSession", back_populates="self_checks")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_session_to_db(db, session_obj):
    from models import (
        ReviewSession, InspectionPoint, InspectionRecord,
        CrackRecord, ConflictItem, MapExport, AuditEntry,
        ImportBatch, SelfCheckResult,
    )

    db_session = db.query(DBReviewSession).filter(
        DBReviewSession.session_id == session_obj.session_id
    ).first()
    if not db_session:
        db_session = DBReviewSession(
            session_id=session_obj.session_id,
            task_name=session_obj.task_name,
            created_at=session_obj.created_at,
            current_step=session_obj.current_step,
        )
        db.add(db_session)
        db.flush()

    db.query(DBInspectionPoint).filter(
        DBInspectionPoint.session_id == session_obj.session_id
    ).delete()
    for pid, p in session_obj.inspection_points.items():
        db.add(DBInspectionPoint(
            session_id=session_obj.session_id,
            point_id=p.point_id,
            name=p.name,
            point_type=p.point_type,
            lat=p.location.lat,
            lng=p.location.lng,
            street=p.location.street,
            is_boundary=p.location.is_boundary,
            adjacent_streets=p.location.adjacent_streets,
        ))

    db.query(DBInspectionRecord).filter(
        DBInspectionRecord.session_id == session_obj.session_id
    ).delete()
    for r in session_obj.records:
        db.add(DBInspectionRecord(
            session_id=session_obj.session_id,
            record_id=r.record_id,
            point_id=r.point_id,
            source=r.source.value,
            inspector=r.inspector,
            inspect_time=r.inspect_time,
            has_waterlogging=r.has_waterlogging,
            water_depth_cm=r.water_depth_cm,
            ramp_accessible=r.ramp_accessible,
            ramp_note=r.ramp_note,
            remarks=r.remarks,
            import_time=r.import_time,
            is_supplementary=r.is_supplementary,
            import_batch_id=r.import_batch_id,
        ))

    db.query(DBCrackRecord).filter(
        DBCrackRecord.session_id == session_obj.session_id
    ).delete()
    for cr in session_obj.crack_records:
        db.add(DBCrackRecord(
            session_id=session_obj.session_id,
            crack_id=cr.crack_id,
            point_id=cr.point_id,
            inspector=cr.inspector,
            inspect_time=cr.inspect_time,
            has_crack=cr.has_crack,
            crack_description=cr.crack_description,
            crack_width_mm=cr.crack_width_mm,
            missing_3d_coords=cr.missing_3d_coords,
            x_coord=cr.x_coord,
            y_coord=cr.y_coord,
            z_coord=cr.z_coord,
            remarks=cr.remarks,
            import_time=cr.import_time,
            import_batch_id=cr.import_batch_id,
        ))

    db.query(DBConflictItem).filter(
        DBConflictItem.session_id == session_obj.session_id
    ).delete()
    for c in session_obj.conflicts:
        db.add(DBConflictItem(
            session_id=session_obj.session_id,
            conflict_id=c.conflict_id,
            point_id=c.point_id,
            field_name=c.field_name,
            ramp_record_value=c.ramp_record_value,
            night_sampling_value=c.night_sampling_value,
            ramp_record_id=c.ramp_record_id,
            night_sampling_id=c.night_sampling_id,
            resolution=c.resolution.value,
            resolved_by=c.resolved_by,
            resolved_time=c.resolved_time,
        ))

    db.query(DBMapExport).filter(
        DBMapExport.session_id == session_obj.session_id
    ).delete()
    for e in session_obj.export_history:
        db.add(DBMapExport(
            session_id=session_obj.session_id,
            export_id=e.export_id,
            export_time=e.export_time,
            exported_by=e.exported_by,
            point_count=e.point_count,
            boundary_points=e.boundary_points,
            conflict_points=e.conflict_points,
            file_hash=e.file_hash,
            file_path=e.file_path,
            file_path_txt=e.file_path.replace(".json", ".txt") if e.file_path else None,
            file_url=f"/api/exports/{session_obj.session_id}/map_export_{e.export_id}.json" if e.file_path else None,
            file_url_txt=f"/api/exports/{session_obj.session_id}/map_export_{e.export_id}.txt" if e.file_path else None,
            records_snapshot=e.records_snapshot,
            conflicts_snapshot=e.conflicts_snapshot,
            audit_snapshot=e.audit_snapshot,
        ))

    db.query(DBAuditEntry).filter(
        DBAuditEntry.session_id == session_obj.session_id
    ).delete()
    for a in session_obj.audit_log:
        db.add(DBAuditEntry(
            session_id=session_obj.session_id,
            audit_id=a.audit_id,
            action_type=a.action_type.value,
            actor=a.actor,
            timestamp=a.timestamp,
            description=a.description,
            before_state=a.before_state,
            after_state=a.after_state,
            related_record_ids=a.related_record_ids,
            related_conflict_ids=a.related_conflict_ids,
            related_export_id=a.related_export_id,
        ))

    db.query(DBImportBatch).filter(
        DBImportBatch.session_id == session_obj.session_id
    ).delete()
    for b in session_obj.import_batches:
        db.add(DBImportBatch(
            session_id=session_obj.session_id,
            batch_id=b.batch_id,
            source=b.source.value,
            imported_by=b.imported_by,
            import_time=b.import_time,
            is_supplementary=b.is_supplementary,
            new_count=b.new_count,
            reused_count=b.reused_count,
            details=[d.to_dict() for d in b.details],
        ))

    db.query(DBSelfCheckResult).filter(
        DBSelfCheckResult.session_id == session_obj.session_id
    ).delete()
    for sc in session_obj.self_check_results:
        db.add(DBSelfCheckResult(
            session_id=session_obj.session_id,
            check_name=sc.check_name,
            passed=sc.passed,
            message=sc.message,
            details=sc.details,
        ))

    db.commit()


def load_session_from_db(db, session_id: str):
    from models import (
        ReviewSession, InspectionPoint, InspectionRecord,
        CrackRecord, ConflictItem, MapExport, AuditEntry,
        ImportBatch, SelfCheckResult, GeoPoint, RecordSource,
        ConflictResolution, AuditActionType, ImportStatus,
        ImportDetail,
    )

    db_session = db.query(DBReviewSession).filter(
        DBReviewSession.session_id == session_id
    ).first()
    if not db_session:
        return None

    session = ReviewSession(
        session_id=db_session.session_id,
        task_name=db_session.task_name,
        created_at=db_session.created_at,
        current_step=db_session.current_step,
    )

    for p in db.query(DBInspectionPoint).filter(
        DBInspectionPoint.session_id == session_id
    ).all():
        loc = GeoPoint(
            lat=p.lat, lng=p.lng, street=p.street,
            is_boundary=p.is_boundary, adjacent_streets=p.adjacent_streets or []
        )
        session.inspection_points[p.point_id] = InspectionPoint(
            point_id=p.point_id, name=p.name, location=loc, point_type=p.point_type
        )

    for r in db.query(DBInspectionRecord).filter(
        DBInspectionRecord.session_id == session_id
    ).all():
        session.records.append(InspectionRecord(
            record_id=r.record_id, point_id=r.point_id,
            source=RecordSource(r.source), inspector=r.inspector,
            inspect_time=r.inspect_time, has_waterlogging=r.has_waterlogging,
            water_depth_cm=r.water_depth_cm, ramp_accessible=r.ramp_accessible,
            ramp_note=r.ramp_note, remarks=r.remarks,
            import_time=r.import_time, is_supplementary=r.is_supplementary,
            import_batch_id=r.import_batch_id,
        ))

    for cr in db.query(DBCrackRecord).filter(
        DBCrackRecord.session_id == session_id
    ).all():
        session.crack_records.append(CrackRecord(
            crack_id=cr.crack_id, point_id=cr.point_id,
            inspector=cr.inspector, inspect_time=cr.inspect_time,
            has_crack=cr.has_crack, crack_description=cr.crack_description,
            crack_width_mm=cr.crack_width_mm,
            missing_3d_coords=cr.missing_3d_coords,
            x_coord=cr.x_coord, y_coord=cr.y_coord, z_coord=cr.z_coord,
            remarks=cr.remarks, import_time=cr.import_time,
            import_batch_id=cr.import_batch_id,
        ))

    for c in db.query(DBConflictItem).filter(
        DBConflictItem.session_id == session_id
    ).all():
        session.conflicts.append(ConflictItem(
            conflict_id=c.conflict_id, point_id=c.point_id,
            field_name=c.field_name,
            ramp_record_value=c.ramp_record_value,
            night_sampling_value=c.night_sampling_value,
            ramp_record_id=c.ramp_record_id,
            night_sampling_id=c.night_sampling_id,
            resolution=ConflictResolution(c.resolution),
            resolved_by=c.resolved_by, resolved_time=c.resolved_time,
        ))

    for e in db.query(DBMapExport).filter(
        DBMapExport.session_id == session_id
    ).all():
        session.export_history.append(MapExport(
            export_id=e.export_id, export_time=e.export_time,
            exported_by=e.exported_by, point_count=e.point_count,
            boundary_points=e.boundary_points or [],
            conflict_points=e.conflict_points or [],
            file_hash=e.file_hash, file_path=e.file_path,
            records_snapshot=e.records_snapshot or [],
            conflicts_snapshot=e.conflicts_snapshot or [],
            audit_snapshot=e.audit_snapshot or [],
        ))

    for a in db.query(DBAuditEntry).filter(
        DBAuditEntry.session_id == session_id
    ).all():
        session.audit_log.append(AuditEntry(
            audit_id=a.audit_id, action_type=AuditActionType(a.action_type),
            actor=a.actor, timestamp=a.timestamp, description=a.description,
            before_state=a.before_state, after_state=a.after_state,
            related_record_ids=a.related_record_ids or [],
            related_conflict_ids=a.related_conflict_ids or [],
            related_export_id=a.related_export_id,
        ))

    for b in db.query(DBImportBatch).filter(
        DBImportBatch.session_id == session_id
    ).all():
        details = []
        for d in b.details or []:
            details.append(ImportDetail(
                record_id=d["record_id"],
                point_id=d["point_id"],
                status=ImportStatus(d["status"]),
                existing_record_id=d.get("existing_record_id"),
                source_value_preview=d.get("source_value_preview"),
            ))
        session.import_batches.append(ImportBatch(
            batch_id=b.batch_id, session_id=b.session_id,
            source=RecordSource(b.source), imported_by=b.imported_by,
            import_time=b.import_time, is_supplementary=b.is_supplementary,
            details=details, new_count=b.new_count, reused_count=b.reused_count,
        ))

    for sc in db.query(DBSelfCheckResult).filter(
        DBSelfCheckResult.session_id == session_id
    ).all():
        session.self_check_results.append(SelfCheckResult(
            check_name=sc.check_name, passed=sc.passed,
            message=sc.message, details=sc.details or {},
        ))

    return session


def list_sessions_from_db(db) -> List[Dict[str, Any]]:
    result = []
    for s in db.query(DBReviewSession).order_by(DBReviewSession.created_at.desc()).all():
        record_count = db.query(DBInspectionRecord).filter(
            DBInspectionRecord.session_id == s.session_id
        ).count()
        conflict_count = db.query(DBConflictItem).filter(
            DBConflictItem.session_id == s.session_id
        ).count()
        export_count = db.query(DBMapExport).filter(
            DBMapExport.session_id == s.session_id
        ).count()
        audit_count = db.query(DBAuditEntry).filter(
            DBAuditEntry.session_id == s.session_id
        ).count()
        result.append({
            "session_id": s.session_id,
            "task_name": s.task_name,
            "created_at": s.created_at.isoformat(),
            "current_step": s.current_step,
            "record_count": record_count,
            "conflict_count": conflict_count,
            "export_count": export_count,
            "audit_count": audit_count,
        })
    return result


init_db()
