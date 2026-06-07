import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from models import (
    ReviewSession,
    InspectionPoint,
    InspectionRecord,
    ConflictItem,
    SelfCheckResult,
    MapExport,
    RecordSource,
    ConflictResolution,
    GeoPoint,
)


def create_session(session_id: Optional[str] = None) -> ReviewSession:
    return ReviewSession(
        session_id=session_id or str(uuid.uuid4())[:8],
        current_step=1,
    )


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
) -> Tuple[ReviewSession, int, List[str]]:
    imported = 0
    skipped_duplicates = []

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
        )
        session.records.append(record)
        imported += 1

    return session, imported, skipped_duplicates


def detect_conflicts(session: ReviewSession) -> Tuple[ReviewSession, List[ConflictItem]]:
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
) -> Tuple[ReviewSession, Optional[ConflictItem]]:
    for conflict in session.conflicts:
        if conflict.conflict_id == conflict_id:
            conflict.resolution = resolution
            conflict.resolved_by = resolved_by
            conflict.resolved_time = datetime.now()
            return session, conflict
    return session, None


def get_pending_conflicts(session: ReviewSession) -> List[ConflictItem]:
    return [c for c in session.conflicts if c.resolution == ConflictResolution.PENDING]
