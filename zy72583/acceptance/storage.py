import json
import os
from dataclasses import asdict
from datetime import datetime
from typing import Dict

from .models import (
    AcceptanceRecord,
    CorrectionLog,
    EvaluationSlice,
    ExperimentComparison,
    FeatureSnapshot,
    RecordStatus,
)


STORAGE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "acceptance_records.json")


def _serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, RecordStatus):
        return obj.value
    raise TypeError(f"Type {type(obj)} not serializable")


def _deserialize_datetime(s):
    return datetime.fromisoformat(s)


def record_to_dict(record: AcceptanceRecord) -> dict:
    return {
        "record_id": record.record_id,
        "status": record.status.value,
        "assignee": record.assignee,
        "next_step": record.next_step,
        "missing_materials": list(record.missing_materials),
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "slice": {
            "slice_id": record.slice.slice_id,
            "name": record.slice.name,
            "offline_score": record.slice.offline_score,
            "online_score": record.slice.online_score,
            "query_count": record.slice.query_count,
            "imported_at": record.slice.imported_at.isoformat(),
            "tags": list(record.slice.tags),
        },
        "feature_snapshot": {
            "snapshot_id": record.feature_snapshot.snapshot_id,
            "slice_id": record.feature_snapshot.slice_id,
            "feature_version": record.feature_snapshot.feature_version,
            "indexed_at": record.feature_snapshot.indexed_at.isoformat(),
            "vector_dim": record.feature_snapshot.vector_dim,
            "index_type": record.feature_snapshot.index_type,
            "remark": record.feature_snapshot.remark,
        } if record.feature_snapshot else None,
        "comparisons": [
            {
                "comparison_id": c.comparison_id,
                "slice_id": c.slice_id,
                "feature_snapshot_id": c.feature_snapshot_id,
                "baseline_offline_score": c.baseline_offline_score,
                "baseline_online_score": c.baseline_online_score,
                "current_offline_score": c.current_offline_score,
                "current_online_score": c.current_online_score,
                "offline_delta": c.offline_delta,
                "online_delta": c.online_delta,
                "conclusion": c.conclusion,
                "generated_at": c.generated_at.isoformat() if c.generated_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in record.comparisons
        ],
        "correction_logs": [
            {
                "timestamp": l.timestamp.isoformat(),
                "operator": l.operator,
                "action": l.action,
                "before": l.before,
                "after": l.after,
                "reason": l.reason,
            }
            for l in record.correction_logs
        ],
    }


def dict_to_record(data: dict) -> AcceptanceRecord:
    slice_data = data["slice"]
    slice_obj = EvaluationSlice(
        slice_id=slice_data["slice_id"],
        name=slice_data["name"],
        offline_score=slice_data["offline_score"],
        online_score=slice_data["online_score"],
        query_count=slice_data["query_count"],
        imported_at=_deserialize_datetime(slice_data["imported_at"]),
        tags=list(slice_data.get("tags", [])),
    )

    fs_data = data.get("feature_snapshot")
    feature_snapshot = None
    if fs_data:
        feature_snapshot = FeatureSnapshot(
            snapshot_id=fs_data["snapshot_id"],
            slice_id=fs_data["slice_id"],
            feature_version=fs_data["feature_version"],
            indexed_at=_deserialize_datetime(fs_data["indexed_at"]),
            vector_dim=fs_data["vector_dim"],
            index_type=fs_data["index_type"],
            remark=fs_data.get("remark", ""),
        )

    comparisons = []
    for c_data in data.get("comparisons", []):
        c = ExperimentComparison(
            comparison_id=c_data["comparison_id"],
            slice_id=c_data["slice_id"],
            feature_snapshot_id=c_data.get("feature_snapshot_id"),
            baseline_offline_score=c_data.get("baseline_offline_score"),
            baseline_online_score=c_data.get("baseline_online_score"),
            current_offline_score=c_data.get("current_offline_score"),
            current_online_score=c_data.get("current_online_score"),
            offline_delta=c_data.get("offline_delta"),
            online_delta=c_data.get("online_delta"),
            conclusion=c_data.get("conclusion", ""),
            generated_at=_deserialize_datetime(c_data["generated_at"]) if c_data.get("generated_at") else None,
            updated_at=_deserialize_datetime(c_data["updated_at"]) if c_data.get("updated_at") else None,
        )
        comparisons.append(c)

    logs = []
    for l_data in data.get("correction_logs", []):
        l = CorrectionLog(
            timestamp=_deserialize_datetime(l_data["timestamp"]),
            operator=l_data["operator"],
            action=l_data["action"],
            before=l_data["before"],
            after=l_data["after"],
            reason=l_data["reason"],
        )
        logs.append(l)

    record = AcceptanceRecord(
        record_id=data["record_id"],
        slice=slice_obj,
        status=RecordStatus(data["status"]),
        feature_snapshot=feature_snapshot,
        comparisons=comparisons,
        correction_logs=logs,
        assignee=data.get("assignee"),
        next_step=data.get("next_step", ""),
        missing_materials=list(data.get("missing_materials", [])),
        created_at=_deserialize_datetime(data["created_at"]),
        updated_at=_deserialize_datetime(data["updated_at"]),
    )
    return record


def save_records(records: Dict[str, AcceptanceRecord], path: str = STORAGE_FILE):
    data = {rid: record_to_dict(r) for rid, r in records.items()}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_serialize_datetime)


def load_records(path: str = STORAGE_FILE) -> Dict[str, AcceptanceRecord]:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {rid: dict_to_record(r_data) for rid, r_data in data.items()}
    except (json.JSONDecodeError, KeyError, ValueError):
        return {}


def clear_storage(path: str = STORAGE_FILE):
    if os.path.exists(path):
        os.remove(path)
