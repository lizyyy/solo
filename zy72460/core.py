import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from models import (
    ReviewSession,
    InspectionPoint,
    InspectionRecord,
    ConflictItem,
    ImportDetail,
    AuditEntry,
    ImportBatch,
    CrackRecord,
    RecordSource,
    ConflictResolution,
    GeoPoint,
    ImportStatus,
    AuditActionType,
)
from persistence import save_session
from database import save_session_to_db, SessionLocal


def _add_audit(
    session: ReviewSession,
    action_type: AuditActionType,
    actor: str,
    description: str,
    before_state: Optional[Dict] = None,
    after_state: Optional[Dict] = None,
    related_record_ids: Optional[List[str]] = None,
    related_conflict_ids: Optional[List[str]] = None,
    related_export_id: Optional[str] = None,
) -> AuditEntry:
    entry = AuditEntry(
        audit_id=str(uuid.uuid4())[:8],
        action_type=action_type,
        actor=actor,
        timestamp=datetime.now(),
        description=description,
        before_state=before_state,
        after_state=after_state,
        related_record_ids=related_record_ids or [],
        related_conflict_ids=related_conflict_ids or [],
        related_export_id=related_export_id,
    )
    session.audit_log.append(entry)
    return entry


def create_session(session_id: Optional[str] = None) -> ReviewSession:
    return ReviewSession(
        session_id=session_id or str(uuid.uuid4())[:8],
        current_step=1,
    )


def _sync_to_storage(session):
    try:
        save_session(session)
        db = SessionLocal()
        try:
            save_session_to_db(db, session)
        finally:
            db.close()
    except Exception:
        pass


def import_inspection_points(
    session: ReviewSession,
    points_data: List[Dict],
) -> Tuple[ReviewSession, int]:
    count = 0
    for pd in points_data:
        point_id = pd["point_id"]
        if point_id in session.inspection_points:
            continue
        loc = GeoPoint(
            lat=pd["lat"],
            lng=pd["lng"],
            street=pd["street"],
            is_boundary=pd.get("is_boundary", False),
            adjacent_streets=pd.get("adjacent_streets", []),
        )
        point = InspectionPoint(
            point_id=point_id,
            name=pd["name"],
            location=loc,
            point_type=pd.get("point_type", "雨水花园"),
        )
        session.inspection_points[point_id] = point
        count += 1
    return session, count


def import_records(
    session: ReviewSession,
    records_data: List[Dict],
    source: RecordSource,
    is_supplementary: bool = False,
    actor: str = "系统",
) -> Tuple[ReviewSession, int, List[str], List[ImportDetail], ImportBatch]:
    imported = 0
    skipped_duplicates = []
    import_details = []
    new_record_ids = []

    batch_id = f"BATCH-{str(uuid.uuid4())[:6]}"

    for rd in records_data:
        record_id = rd.get("record_id", str(uuid.uuid4())[:8])
        point_id = rd["point_id"]

        existing = [
            r
            for r in session.records
            if r.point_id == point_id
            and r.source == source
            and r.inspect_time == datetime.fromisoformat(rd["inspect_time"])
        ]
        if existing:
            skipped_duplicates.append(point_id)
            import_details.append(
                ImportDetail(
                    record_id=record_id,
                    point_id=point_id,
                    status=ImportStatus.REUSED,
                    existing_record_id=existing[0].record_id,
                    source_value_preview=f"积水={existing[0].has_waterlogging}, 坡道可用={existing[0].ramp_accessible}",
                )
            )
            continue

        record = InspectionRecord(
            record_id=record_id,
            point_id=point_id,
            source=source,
            inspector=rd["inspector"],
            inspect_time=datetime.fromisoformat(rd["inspect_time"]),
            has_waterlogging=rd["has_waterlogging"],
            water_depth_cm=rd.get("water_depth_cm"),
            ramp_accessible=rd.get("ramp_accessible"),
            ramp_note=rd.get("ramp_note"),
            remarks=rd.get("remarks"),
            is_supplementary=is_supplementary,
            import_batch_id=batch_id,
        )
        session.records.append(record)
        imported += 1
        new_record_ids.append(record_id)
        import_details.append(
            ImportDetail(
                record_id=record_id,
                point_id=point_id,
                status=ImportStatus.NEW,
                source_value_preview=f"积水={record.has_waterlogging}, 坡道可用={record.ramp_accessible}",
            )
        )

    batch = ImportBatch(
        batch_id=batch_id,
        session_id=session.session_id,
        source=source,
        imported_by=actor,
        import_time=datetime.now(),
        is_supplementary=is_supplementary,
        details=import_details,
        new_count=imported,
        reused_count=len(skipped_duplicates),
    )
    session.import_batches.append(batch)

    action = AuditActionType.SUPPLEMENTARY_REVIEW if is_supplementary else AuditActionType.IMPORT
    desc = f"导入{source.value}记录 {imported} 条"
    if skipped_duplicates:
        desc += f"，复用已有 {len(skipped_duplicates)} 条"

    _add_audit(
        session,
        action,
        actor,
        desc,
        after_state={
            "source": source.value,
            "batch_id": batch_id,
            "new_count": imported,
            "reused_count": len(skipped_duplicates),
            "new_record_ids": new_record_ids,
            "reused_point_ids": skipped_duplicates,
            "details": [d.to_dict() for d in import_details],
        },
        related_record_ids=new_record_ids,
    )

    _sync_to_storage(session)
    return session, imported, skipped_duplicates, import_details, batch


def import_crack_records(
    session: ReviewSession,
    records_data: List[Dict],
    actor: str = "系统",
) -> Tuple[ReviewSession, int, ImportBatch]:
    imported = 0
    batch_id = f"BATCH-CRACK-{str(uuid.uuid4())[:6]}"
    details = []
    crack_ids = []

    for rd in records_data:
        crack_id = rd.get("crack_id", str(uuid.uuid4())[:8])
        point_id = rd["point_id"]

        existing = [
            c
            for c in session.crack_records
            if c.point_id == point_id
            and c.inspect_time == datetime.fromisoformat(rd["inspect_time"])
        ]
        if existing:
            details.append(
                ImportDetail(
                    record_id=crack_id,
                    point_id=point_id,
                    status=ImportStatus.REUSED,
                    existing_record_id=existing[0].crack_id,
                    source_value_preview=f"裂缝={existing[0].has_crack}",
                )
            )
            continue

        crack = CrackRecord(
            crack_id=crack_id,
            point_id=point_id,
            inspector=rd["inspector"],
            inspect_time=datetime.fromisoformat(rd["inspect_time"]),
            has_crack=rd["has_crack"],
            crack_description=rd.get("crack_description"),
            crack_width_mm=rd.get("crack_width_mm"),
            missing_3d_coords=rd.get("missing_3d_coords", False),
            x_coord=rd.get("x_coord"),
            y_coord=rd.get("y_coord"),
            z_coord=rd.get("z_coord"),
            remarks=rd.get("remarks"),
            import_batch_id=batch_id,
        )
        session.crack_records.append(crack)
        imported += 1
        crack_ids.append(crack_id)
        details.append(
            ImportDetail(
                record_id=crack_id,
                point_id=point_id,
                status=ImportStatus.NEW,
                source_value_preview=f"裂缝={crack.has_crack}, 缺三维={crack.missing_3d_coords}",
            )
        )

    batch = ImportBatch(
        batch_id=batch_id,
        session_id=session.session_id,
        source=RecordSource.CRACK_SUPPLEMENTARY,
        imported_by=actor,
        import_time=datetime.now(),
        is_supplementary=True,
        details=details,
        new_count=imported,
        reused_count=len(records_data) - imported,
    )
    session.import_batches.append(batch)

    desc = f"导入裂缝补录记录 {imported} 条"
    if len(records_data) - imported > 0:
        desc += f"，复用已有 {len(records_data) - imported} 条"

    _add_audit(
        session,
        AuditActionType.CRACK_RECORD,
        actor,
        desc,
        after_state={
            "batch_id": batch_id,
            "new_count": imported,
            "reused_count": len(records_data) - imported,
            "new_crack_ids": crack_ids,
            "details": [d.to_dict() for d in details],
        },
        related_record_ids=crack_ids,
    )

    _sync_to_storage(session)
    return session, imported, batch


def detect_conflicts(
    session: ReviewSession, actor: str = "系统"
) -> Tuple[ReviewSession, List[ConflictItem]]:
    ramp_records = [r for r in session.records if r.source == RecordSource.RAMP_SURVEY]
    night_records = [r for r in session.records if r.source == RecordSource.NIGHT_SAMPLING]

    new_conflicts = []
    compare_fields = ["has_waterlogging", "ramp_accessible"]

    for ramp_rec in ramp_records:
        for night_rec in night_records:
            if ramp_rec.point_id != night_rec.point_id:
                continue

            for field in compare_fields:
                ramp_val = getattr(ramp_rec, field)
                night_val = getattr(night_rec, field)

                if ramp_val is None or night_val is None:
                    continue

                if ramp_val == night_val:
                    continue

                existing = [
                    c
                    for c in session.conflicts
                    if c.point_id == ramp_rec.point_id
                    and c.field_name == field
                    and c.resolution == ConflictResolution.PENDING
                ]
                if existing:
                    continue

                conflict = ConflictItem(
                    conflict_id=str(uuid.uuid4())[:8],
                    point_id=ramp_rec.point_id,
                    field_name=field,
                    ramp_record_value=ramp_val,
                    night_sampling_value=night_val,
                    ramp_record_id=ramp_rec.record_id,
                    night_sampling_id=night_rec.record_id,
                )
                session.conflicts.append(conflict)
                new_conflicts.append(conflict)

    if new_conflicts:
        conflict_ids = [c.conflict_id for c in new_conflicts]
        point_ids = list(set(c.point_id for c in new_conflicts))
        _add_audit(
            session,
            AuditActionType.CONFLICT_DETECTED,
            actor,
            f"发现 {len(new_conflicts)} 个冲突，涉及点位: {', '.join(point_ids)}",
            before_state={
                "ramp_records_involved": [c.ramp_record_id for c in new_conflicts],
                "night_records_involved": [c.night_sampling_id for c in new_conflicts],
            },
            after_state={
                "conflict_ids": conflict_ids,
                "fields": [c.field_name for c in new_conflicts],
            },
            related_record_ids=[c.ramp_record_id for c in new_conflicts]
            + [c.night_sampling_id for c in new_conflicts],
            related_conflict_ids=conflict_ids,
        )

    _sync_to_storage(session)
    return session, new_conflicts


def get_boundary_points(session: ReviewSession) -> List[InspectionPoint]:
    return [p for p in session.inspection_points.values() if p.location.is_boundary]


def get_point_records(session: ReviewSession, point_id: str) -> List[InspectionRecord]:
    return [r for r in session.records if r.point_id == point_id]


def resolve_conflict(
    session: ReviewSession,
    conflict_id: str,
    resolution: ConflictResolution,
    resolved_by: str,
    reason: Optional[str] = None,
) -> Tuple[ReviewSession, Optional[ConflictItem]]:
    for conflict in session.conflicts:
        if conflict.conflict_id == conflict_id:
            before_state = {
                "conflict_id": conflict.conflict_id,
                "point_id": conflict.point_id,
                "field_name": conflict.field_name,
                "resolution_before": conflict.resolution.value,
                "ramp_record_value": conflict.ramp_record_value,
                "night_sampling_value": conflict.night_sampling_value,
            }

            conflict.resolution = resolution
            conflict.resolved_by = resolved_by
            conflict.resolved_time = datetime.now()

            after_state = {
                "conflict_id": conflict.conflict_id,
                "resolution_after": conflict.resolution.value,
                "resolved_by": conflict.resolved_by,
                "resolved_time": conflict.resolved_time.isoformat(),
                "reason": reason,
            }

            _add_audit(
                session,
                AuditActionType.CONFLICT_RESOLVED,
                resolved_by,
                f"冲突 {conflict_id} 由 {resolved_by} 处理为「{resolution.value}」"
                + (f"，原因: {reason}" if reason else ""),
                before_state=before_state,
                after_state=after_state,
                related_record_ids=[conflict.ramp_record_id, conflict.night_sampling_id],
                related_conflict_ids=[conflict_id],
            )

            _sync_to_storage(session)
            return session, conflict
    return session, None


def get_pending_conflicts(session: ReviewSession) -> List[ConflictItem]:
    return [c for c in session.conflicts if c.resolution == ConflictResolution.PENDING]


def get_audit_for_record(session: ReviewSession, record_id: str) -> List[AuditEntry]:
    return [
        a for a in session.audit_log if record_id in a.related_record_ids
    ]


def get_audit_for_conflict(session: ReviewSession, conflict_id: str) -> List[AuditEntry]:
    return [
        a for a in session.audit_log if conflict_id in a.related_conflict_ids
    ]


def get_audit_for_export(session: ReviewSession, export_id: str) -> List[AuditEntry]:
    return [
        a for a in session.audit_log if a.related_export_id == export_id
    ]


def get_import_details(session: ReviewSession) -> List[AuditEntry]:
    return [
        a for a in session.audit_log
        if a.action_type in (AuditActionType.IMPORT, AuditActionType.SUPPLEMENTARY_REVIEW)
    ]
