from __future__ import annotations

import json
import os
from typing import Optional

from .models import RollbackRecord, EvidenceRef, EvidenceType


class RollbackTracker:
    def __init__(self, store_dir: str):
        self.store_dir = os.path.join(store_dir, "rollbacks")
        os.makedirs(self.store_dir, exist_ok=True)

    def record_rollback(
        self,
        target_package: str,
        target_version: str,
        previous_version: str = "",
        reason: str = "",
        operator: str = "",
        snapshot_id: str = "",
        metadata: Optional[dict] = None,
    ) -> RollbackRecord:
        record = RollbackRecord(
            record_id="",
            target_package=target_package,
            target_version=target_version,
            previous_version=previous_version,
            reason=reason,
            operator=operator,
            snapshot_id=snapshot_id,
            metadata=metadata or {},
        )
        self._save_record(record)
        return record

    def get_record(self, record_id: str) -> Optional[RollbackRecord]:
        path = os.path.join(self.store_dir, f"{record_id}.json")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RollbackRecord.from_dict(data)

    def list_records(
        self, package_filter: Optional[str] = None
    ) -> list[RollbackRecord]:
        records = []
        if not os.path.isdir(self.store_dir):
            return records
        for fname in os.listdir(self.store_dir):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.store_dir, fname)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                record = RollbackRecord.from_dict(data)
                if package_filter and record.target_package != package_filter:
                    continue
                records.append(record)
            except Exception:
                continue
        return sorted(records, key=lambda r: r.timestamp)

    def find_rollbacks_for_package(self, package_name: str) -> list[RollbackRecord]:
        return self.list_records(package_filter=package_name)

    def enrich_entry_with_rollback_evidence(
        self, package_name: str, entry_refs: list[EvidenceRef]
    ) -> list[EvidenceRef]:
        records = self.find_rollbacks_for_package(package_name)
        for record in records:
            entry_refs.append(
                EvidenceRef(
                    evidence_type=EvidenceType.ROLLBACK_RECORD,
                    record_id=record.record_id,
                    detail=(
                        f"回滚: {record.target_package} "
                        f"从 {record.previous_version} → {record.target_version}, "
                        f"原因: {record.reason}, 操作人: {record.operator}"
                    ),
                )
            )
        return entry_refs

    def _save_record(self, record: RollbackRecord) -> None:
        path = os.path.join(self.store_dir, f"{record.record_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
