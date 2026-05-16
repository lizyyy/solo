import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import uuid4

from .models import (
    HandoverRecord,
    Material,
    Attachment,
    RecordStatus,
    AttachmentStatus
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.records_file = self.data_dir / "handover_records.json"
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        if not self.records_file.exists():
            with open(self.records_file, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _datetime_from_iso(self, value: Optional[str]) -> Optional[datetime]:
        if value is None:
            return None
        return datetime.fromisoformat(value)

    def _serialize_record(self, record: HandoverRecord) -> Dict[str, Any]:
        return {
            "id": record.id,
            "title": record.title,
            "description": record.description,
            "operator": record.operator,
            "status": record.status.value,
            "materials": [
                {
                    "id": m.id,
                    "name": m.name,
                    "type": m.type,
                    "content": m.content,
                    "attachments": [
                        {
                            "id": a.id,
                            "name": a.name,
                            "file_path": a.file_path,
                            "upload_time": a.upload_time.isoformat(),
                            "expire_time": a.expire_time.isoformat() if a.expire_time else None,
                            "status": a.status.value
                        }
                        for a in m.attachments
                    ],
                    "created_at": m.created_at.isoformat(),
                    "updated_at": m.updated_at.isoformat()
                }
                for m in record.materials
            ],
            "system_judgment": {
                "is_abnormal": record.system_judgment.is_abnormal,
                "reason": record.system_judgment.reason,
                "detected_at": record.system_judgment.detected_at.isoformat(),
                "details": record.system_judgment.details
            } if record.system_judgment else None,
            "remarks": [
                {
                    "id": r.id,
                    "content": r.content,
                    "operator": r.operator,
                    "created_at": r.created_at.isoformat(),
                    "reason": r.reason
                }
                for r in record.remarks
            ],
            "manual_corrections": [
                {
                    "id": c.id,
                    "operator": c.operator,
                    "correction_type": c.correction_type,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "reason": c.reason,
                    "created_at": c.created_at.isoformat(),
                    "resource_scope": c.resource_scope
                }
                for c in record.manual_corrections
            ],
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat()
        }

    def _deserialize_record(self, data: Dict[str, Any]) -> HandoverRecord:
        materials = [
            Material(
                id=m["id"],
                name=m["name"],
                type=m["type"],
                content=m["content"],
                attachments=[
                    Attachment(
                        id=a["id"],
                        name=a["name"],
                        file_path=a["file_path"],
                        upload_time=self._datetime_from_iso(a["upload_time"]),
                        expire_time=self._datetime_from_iso(a["expire_time"]),
                        status=AttachmentStatus(a["status"])
                    )
                    for a in m["attachments"]
                ],
                created_at=self._datetime_from_iso(m["created_at"]),
                updated_at=self._datetime_from_iso(m["updated_at"])
            )
            for m in data["materials"]
        ]

        record = HandoverRecord(
            id=data["id"],
            title=data["title"],
            description=data["description"],
            operator=data["operator"],
            materials=materials,
            status=RecordStatus(data["status"]),
            created_at=self._datetime_from_iso(data["created_at"]),
            updated_at=self._datetime_from_iso(data["updated_at"])
        )

        if data["system_judgment"]:
            sj = data["system_judgment"]
            record.system_judgment = type('SystemJudgment', (), {
                "is_abnormal": sj["is_abnormal"],
                "reason": sj["reason"],
                "detected_at": self._datetime_from_iso(sj["detected_at"]),
                "details": sj["details"]
            })()

        record.remarks = [
            type('Remark', (), {
                "id": r["id"],
                "content": r["content"],
                "operator": r["operator"],
                "created_at": self._datetime_from_iso(r["created_at"]),
                "reason": r["reason"]
            })()
            for r in data["remarks"]
        ]

        record.manual_corrections = [
            type('ManualCorrection', (), {
                "id": c["id"],
                "operator": c["operator"],
                "correction_type": c["correction_type"],
                "old_value": c["old_value"],
                "new_value": c["new_value"],
                "reason": c["reason"],
                "created_at": self._datetime_from_iso(c["created_at"]),
                "resource_scope": c["resource_scope"]
            })()
            for c in data["manual_corrections"]
        ]

        return record

    def save_record(self, record: HandoverRecord) -> None:
        records = self.load_all_records()
        existing = next((r for r in records if r.id == record.id), None)
        if existing:
            records = [r if r.id != record.id else record for r in records]
        else:
            records.append(record)
        
        self._save_records(records)

    def _save_records(self, records: List[HandoverRecord]) -> None:
        serialized = [self._serialize_record(r) for r in records]
        with open(self.records_file, 'w', encoding='utf-8') as f:
            json.dump(serialized, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)

    def load_all_records(self) -> List[HandoverRecord]:
        with open(self.records_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [self._deserialize_record(item) for item in data]

    def load_record_by_id(self, record_id: str) -> Optional[HandoverRecord]:
        records = self.load_all_records()
        return next((r for r in records if r.id == record_id), None)

    def delete_record(self, record_id: str) -> bool:
        records = self.load_all_records()
        filtered = [r for r in records if r.id != record_id]
        if len(filtered) != len(records):
            self._save_records(filtered)
            return True
        return False