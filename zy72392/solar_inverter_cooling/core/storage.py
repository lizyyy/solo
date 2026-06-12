import json
import os
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

from .models import (
    InspectionBatch, RepairGroupScreenshot, SamplingIntervalNote,
    AbnormalRecord, AuditLog
)


def _serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def _deserialize_datetime(s: str) -> datetime:
    return datetime.fromisoformat(s)


class Storage:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.batches_dir = self.data_dir / "batches"
        self.batches_dir.mkdir(parents=True, exist_ok=True)

    def _batch_path(self, batch_id: str) -> Path:
        return self.batches_dir / f"{batch_id}.json"

    def save_batch(self, batch: InspectionBatch) -> None:
        data = {
            "id": batch.id,
            "name": batch.name,
            "created_at": _serialize_datetime(batch.created_at),
            "status": batch.status,
            "run_count": batch.run_count,
            "repair_screenshots": [
                {
                    "id": s.id,
                    "batch_id": s.batch_id,
                    "filename": s.filename,
                    "upload_time": _serialize_datetime(s.upload_time),
                    "uploader": s.uploader,
                    "content": s.content,
                    "raw_text": s.raw_text,
                }
                for s in batch.repair_screenshots
            ],
            "sampling_notes": [
                {
                    "id": n.id,
                    "batch_id": n.batch_id,
                    "filename": n.filename,
                    "upload_time": _serialize_datetime(n.upload_time),
                    "uploader": n.uploader,
                    "content": n.content,
                    "raw_text": n.raw_text,
                }
                for n in batch.sampling_notes
            ],
            "abnormal_records": [
                {
                    "id": r.id,
                    "batch_id": r.batch_id,
                    "point_id": r.point_id,
                    "point_name": r.point_name,
                    "status": r.status.value,
                    "direction_status": r.direction_status.value,
                    "keep_reason": r.keep_reason,
                    "missing_materials": r.missing_materials,
                    "next_handler": r.next_handler.value,
                    "evidence_sources": r.evidence_sources,
                    "created_at": _serialize_datetime(r.created_at),
                    "updated_at": _serialize_datetime(r.updated_at),
                    "notes": r.notes,
                    "field_mention": r.field_mention,
                    "direction_field_text": r.direction_field_text,
                    "is_field_dispute": r.is_field_dispute,
                    "trigger_source": r.trigger_source,
                    "resolution_trace": r.resolution_trace,
                }
                for r in batch.abnormal_records
            ],
            "audit_logs": [
                {
                    "id": l.id,
                    "batch_id": l.batch_id,
                    "timestamp": _serialize_datetime(l.timestamp),
                    "operator": l.operator,
                    "action": l.action,
                    "field_changed": l.field_changed,
                    "old_value": l.old_value,
                    "new_value": l.new_value,
                    "reason": l.reason,
                    "affected_results": l.affected_results,
                }
                for l in batch.audit_logs
            ],
        }
        with open(self._batch_path(batch.id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_batch(self, batch_id: str) -> Optional[InspectionBatch]:
        path = self._batch_path(batch_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        from .models import (
            DirectionStatus, NextHandler, AbnormalStatus
        )

        batch = InspectionBatch(
            id=data["id"],
            name=data["name"],
            created_at=_deserialize_datetime(data["created_at"]),
            status=data["status"],
            run_count=data.get("run_count", 0),
        )
        batch.repair_screenshots = [
            RepairGroupScreenshot(
                id=s["id"],
                batch_id=s["batch_id"],
                filename=s["filename"],
                upload_time=_deserialize_datetime(s["upload_time"]),
                uploader=s["uploader"],
                content=s["content"],
                raw_text=s.get("raw_text", ""),
            )
            for s in data["repair_screenshots"]
        ]
        batch.sampling_notes = [
            SamplingIntervalNote(
                id=n["id"],
                batch_id=n["batch_id"],
                filename=n.get("filename"),
                upload_time=_deserialize_datetime(n["upload_time"]),
                uploader=n["uploader"],
                content=n["content"],
                raw_text=n.get("raw_text", ""),
            )
            for n in data["sampling_notes"]
        ]
        batch.abnormal_records = [
            AbnormalRecord(
                id=r["id"],
                batch_id=r["batch_id"],
                point_id=r["point_id"],
                point_name=r["point_name"],
                status=AbnormalStatus(r["status"]),
                direction_status=DirectionStatus(r["direction_status"]),
                keep_reason=r["keep_reason"],
                missing_materials=r["missing_materials"],
                next_handler=NextHandler(r["next_handler"]),
                evidence_sources=r["evidence_sources"],
                created_at=_deserialize_datetime(r["created_at"]),
                updated_at=_deserialize_datetime(r["updated_at"]),
                notes=r.get("notes", ""),
                field_mention=r.get("field_mention", ""),
                direction_field_text=r.get("direction_field_text", ""),
                is_field_dispute=r.get("is_field_dispute", False),
                trigger_source=r.get("trigger_source", ""),
                resolution_trace=r.get("resolution_trace", []),
            )
            for r in data["abnormal_records"]
        ]
        batch.audit_logs = [
            AuditLog(
                id=l["id"],
                batch_id=l["batch_id"],
                timestamp=_deserialize_datetime(l["timestamp"]),
                operator=l["operator"],
                action=l["action"],
                field_changed=l["field_changed"],
                old_value=l["old_value"],
                new_value=l["new_value"],
                reason=l["reason"],
                affected_results=l["affected_results"],
            )
            for l in data["audit_logs"]
        ]
        return batch

    def list_batches(self) -> list:
        batches = []
        for f in self.batches_dir.glob("*.json"):
            batch_id = f.stem
            batch = self.load_batch(batch_id)
            if batch:
                batches.append({
                    "id": batch.id,
                    "name": batch.name,
                    "created_at": batch.created_at,
                    "status": batch.status,
                    "abnormal_count": len(batch.abnormal_records),
                })
        return sorted(batches, key=lambda x: x["created_at"], reverse=True)
