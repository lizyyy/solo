import json
import os
from datetime import datetime
from typing import Optional
from models import (
    MergeSession,
    MergeRecord,
    Point,
    AuditLog,
    ConflictEvidence,
    RecordSource,
    RecordStatus,
    PointStatus,
)


def _encode_datetime(dt: datetime) -> str:
    return dt.isoformat()


def _decode_datetime(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def save_session(session: MergeSession, output_dir: str = "sessions") -> str:
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"{session.session_id}.json")

    data = {
        "session_id": session.session_id,
        "name": session.name,
        "created_at": _encode_datetime(session.created_at),
        "completed_at": _encode_datetime(session.completed_at) if session.completed_at else None,
        "replay_commands": list(session.replay_commands),
        "records": [],
        "points": [],
    }

    for record in session.records:
        data["records"].append(
            {
                "record_id": record.record_id,
                "house_number": record.house_number,
                "address": record.address,
                "source": record.source.value,
                "status": record.status.value,
                "resident_complaint_id": record.resident_complaint_id,
                "intersection_photo_id": record.intersection_photo_id,
                "point_id": record.point_id,
                "is_temporary_detour": record.is_temporary_detour,
                "is_old_standard": record.is_old_standard,
                "created_at": _encode_datetime(record.created_at),
                "updated_at": _encode_datetime(record.updated_at),
                "remark": record.remark,
                "conflicts": [
                    {
                        "field_name": c.field_name,
                        "complaint_value": c.complaint_value,
                        "photo_value": c.photo_value,
                        "description": c.description,
                    }
                    for c in record.conflicts
                ],
                "audit_logs": [
                    {
                        "timestamp": _encode_datetime(log.timestamp),
                        "operator": log.operator,
                        "action": log.action,
                        "before_status": log.before_status,
                        "after_status": log.after_status,
                        "remark": log.remark,
                    }
                    for log in record.audit_logs
                ],
            }
        )

    for point in session.points:
        data["points"].append(
            {
                "point_id": point.point_id,
                "house_number": point.house_number,
                "address": point.address,
                "status": point.status.value,
                "source_records": list(point.source_records),
                "created_at": _encode_datetime(point.created_at),
                "updated_at": _encode_datetime(point.updated_at),
                "remark": point.remark,
            }
        )

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return file_path


def load_session(session_id: str, session_dir: str = "sessions") -> Optional[MergeSession]:
    file_path = os.path.join(session_dir, f"{session_id}.json")
    if not os.path.exists(file_path):
        return None

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    session = MergeSession(
        session_id=data["session_id"],
        name=data["name"],
        created_at=_decode_datetime(data["created_at"]) or datetime.now(),
        completed_at=_decode_datetime(data.get("completed_at")),
        replay_commands=list(data.get("replay_commands", [])),
    )

    for rec_data in data.get("records", []):
        record = MergeRecord(
            record_id=rec_data["record_id"],
            house_number=rec_data["house_number"],
            address=rec_data["address"],
            source=RecordSource(rec_data["source"]),
            status=RecordStatus(rec_data["status"]),
            resident_complaint_id=rec_data.get("resident_complaint_id"),
            intersection_photo_id=rec_data.get("intersection_photo_id"),
            point_id=rec_data.get("point_id"),
            is_temporary_detour=rec_data.get("is_temporary_detour", False),
            is_old_standard=rec_data.get("is_old_standard", False),
            created_at=_decode_datetime(rec_data.get("created_at")) or datetime.now(),
            updated_at=_decode_datetime(rec_data.get("updated_at")) or datetime.now(),
            remark=rec_data.get("remark", ""),
            conflicts=[
                ConflictEvidence(
                    field_name=c["field_name"],
                    complaint_value=c["complaint_value"],
                    photo_value=c["photo_value"],
                    description=c["description"],
                )
                for c in rec_data.get("conflicts", [])
            ],
            audit_logs=[
                AuditLog(
                    timestamp=_decode_datetime(log["timestamp"]) or datetime.now(),
                    operator=log["operator"],
                    action=log["action"],
                    before_status=log.get("before_status"),
                    after_status=log.get("after_status"),
                    remark=log.get("remark", ""),
                )
                for log in rec_data.get("audit_logs", [])
            ],
        )
        session.records.append(record)

    for pt_data in data.get("points", []):
        point = Point(
            point_id=pt_data["point_id"],
            house_number=pt_data["house_number"],
            address=pt_data["address"],
            status=PointStatus(pt_data["status"]),
            source_records=list(pt_data.get("source_records", [])),
            created_at=_decode_datetime(pt_data.get("created_at")) or datetime.now(),
            updated_at=_decode_datetime(pt_data.get("updated_at")) or datetime.now(),
            remark=pt_data.get("remark", ""),
        )
        session.points.append(point)

    return session
