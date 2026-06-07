import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from .base import VersionedModel


@dataclass
class CandidateRecord(VersionedModel):
    record_id: str = ""
    features: Dict[str, float] = field(default_factory=dict)
    remark: str = ""
    tags: List[str] = field(default_factory=list)
    source: str = ""

    def __post_init__(self):
        super().__init__()
        if not self.id:
            self.id = f"rec_{self.record_id}"
        self._content_hash = self._compute_hash(self._get_public_state())

    def get_record_hash(self) -> str:
        data = {
            "record_id": self.record_id,
            "features": dict(sorted(self.features.items())),
        }
        return hashlib.sha256(
            str(data).encode()
        ).hexdigest()


class CandidateTable(VersionedModel):
    def __init__(self, name: str, source: str = ""):
        super().__init__()
        self.id = f"ctbl_{name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.name: str = name
        self.source: str = source
        self.records: Dict[str, CandidateRecord] = {}
        self._record_hashes: Dict[str, str] = {}

    def add_record(self, record: CandidateRecord, operator: str, reason: str = "") -> bool:
        rec_hash = record.get_record_hash()
        if rec_hash in self._record_hashes:
            return False

        self.records[record.record_id] = record
        self._record_hashes[rec_hash] = record.record_id
        self.updated_at = datetime.now()
        self.updated_by = operator
        self._audit_logs.append(AuditLog(
            operation="add_record",
            operator=operator,
            reason=reason,
            details={"record_id": record.record_id, "hash": rec_hash},
            affected_ids=[record.id],
        ))
        self._content_hash = self._compute_hash(self._get_public_state())
        return True

    def add_records_batch(self, records: List[CandidateRecord], operator: str, reason: str = "") -> Dict[str, Any]:
        added = []
        skipped = []
        for rec in records:
            if self.add_record(rec, operator, reason):
                added.append(rec.record_id)
            else:
                skipped.append(rec.record_id)

        return {
            "total": len(records),
            "added_count": len(added),
            "skipped_count": len(skipped),
            "added_ids": added,
            "skipped_ids": skipped,
        }

    def update_record_remark(self, record_id: str, new_remark: str, operator: str, reason: str = "") -> Optional[List]:
        if record_id not in self.records:
            return None
        record = self.records[record_id]
        diffs = record.update({"remark": new_remark}, operator, reason)
        if diffs:
            self.updated_at = datetime.now()
            self._content_hash = self._compute_hash(self._get_public_state())
        return diffs

    def get_record(self, record_id: str) -> Optional[CandidateRecord]:
        return self.records.get(record_id)

    def get_record_count(self) -> int:
        return len(self.records)

    def _get_public_state(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "version": self.version,
            "name": self.name,
            "source": self.source,
            "record_count": len(self.records),
            "record_ids": sorted(self.records.keys()),
        }


from .base import AuditLog
