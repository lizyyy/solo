import os
import csv
import uuid
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from .models import BuoyRecord, AuditLog, DuplicateIssue


class DataStore:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.records_path = os.path.join(data_dir, "records.csv")
        self.audit_path = os.path.join(data_dir, "audit_logs.csv")
        self.duplicates_path = os.path.join(data_dir, "duplicate_issues.csv")
        self._ensure_files()

    def _ensure_files(self):
        if not os.path.exists(self.records_path):
            self._write_csv(self.records_path, BuoyRecord.fieldnames(), [])
        if not os.path.exists(self.audit_path):
            self._write_csv(self.audit_path, AuditLog.fieldnames(), [])
        if not os.path.exists(self.duplicates_path):
            self._write_csv(self.duplicates_path, DuplicateIssue.fieldnames(), [])

    @staticmethod
    def _write_csv(path: str, fieldnames: List[str], rows: List[dict]):
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in rows:
                writer.writerow(r)

    @staticmethod
    def _read_csv(path: str) -> List[dict]:
        if not os.path.exists(path):
            return []
        with open(path, "r", newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def load_records(self) -> List[BuoyRecord]:
        return [BuoyRecord.from_row(r) for r in self._read_csv(self.records_path)]

    def save_records(self, records: List[BuoyRecord]):
        self._write_csv(self.records_path, BuoyRecord.fieldnames(), [r.to_row() for r in records])

    def load_audit_logs(self) -> List[AuditLog]:
        return [AuditLog.from_row(r) for r in self._read_csv(self.audit_path)]

    def append_audit_log(self, log: AuditLog):
        rows = self._read_csv(self.audit_path)
        rows.append(log.to_row())
        self._write_csv(self.audit_path, AuditLog.fieldnames(), rows)

    def load_duplicate_issues(self) -> List[DuplicateIssue]:
        result = []
        for r in self._read_csv(self.duplicates_path):
            ids = [x for x in r.get("affected_record_ids", "").split(",") if x]
            result.append(DuplicateIssue(
                sample_bottle_id=r.get("sample_bottle_id", ""),
                affected_records=ids,
                reason=r.get("reason", ""),
            ))
        return result

    def save_duplicate_issues(self, issues: List[DuplicateIssue]):
        self._write_csv(self.duplicates_path, DuplicateIssue.fieldnames(), [i.to_row() for i in issues])


class BuoyCleaner:
    def __init__(self, store: DataStore):
        self.store = store

    def _dedup_key(self, r: BuoyRecord) -> str:
        parts = [r.buoy_id.strip(), r.sample_bottle_id.strip(), r.timestamp.strip()]
        return "|".join(parts)

    def import_records(
        self,
        new_records: List[BuoyRecord],
        batch_id: str,
        operator: str = "system",
    ) -> Dict[str, int]:
        from .geo_cleaner import standardize_record

        existing = self.store.load_records()
        existing_keys = {self._dedup_key(r): r for r in existing}
        existing_bottle_groups: Dict[str, List[BuoyRecord]] = defaultdict(list)
        for r in existing:
            if r.sample_bottle_id:
                existing_bottle_groups[r.sample_bottle_id.strip()].append(r)

        added = 0
        skipped = 0
        note_preserved = 0

        for r in new_records:
            r.import_batch = batch_id
            lat, lon = standardize_record(r)
            r.latitude_std = lat
            r.longitude_std = lon
            if lat is None or lon is None:
                r.status = "坐标异常待确认"
            else:
                r.status = r.status if r.status != "pending" else "已清洗"

            key = self._dedup_key(r)
            if key in existing_keys:
                skipped += 1
                old = existing_keys[key]
                if old.manual_note and not r.manual_note:
                    r.manual_note = old.manual_note
                    note_preserved += 1
                continue

            if r.sample_bottle_id:
                bottle_key = r.sample_bottle_id.strip()
                if bottle_key in existing_bottle_groups:
                    r.status = "采样瓶重复待确认"
                existing_bottle_groups[bottle_key].append(r)

            existing.append(r)
            existing_keys[key] = r
            added += 1

        self.store.save_records(existing)
        self._refresh_duplicate_issues()

        return {"added": added, "skipped": skipped, "note_preserved": note_preserved}

    def _refresh_duplicate_issues(self):
        records = self.store.load_records()
        groups: Dict[str, List[BuoyRecord]] = defaultdict(list)
        for r in records:
            if r.sample_bottle_id:
                groups[r.sample_bottle_id.strip()].append(r)

        issues = []
        for bottle_id, recs in groups.items():
            if len(recs) > 1:
                reasons = []
                statuses = {r.status for r in recs}
                if any("重复" in s for s in statuses):
                    reasons.append("同一采样瓶号出现多条记录，需人工确认是否为补采或误录")
                if any(r.is_late_arrival for r in recs):
                    reasons.append("组内包含晚到附件记录")
                issues.append(DuplicateIssue(
                    sample_bottle_id=bottle_id,
                    affected_records=[r.record_id for r in recs],
                    reason="；".join(reasons) or "采样瓶号重复",
                ))
        self.store.save_duplicate_issues(issues)

        for r in records:
            if r.sample_bottle_id and r.sample_bottle_id.strip() in [i.sample_bottle_id for i in issues]:
                if "重复" not in r.status and r.status not in ("已确认正常", "已确认异常"):
                    r.status = "采样瓶重复待确认"
        self.store.save_records(records)

    def confirm_record(
        self,
        record_id: str,
        new_status: str,
        reason: str,
        operator: str,
        manual_note: Optional[str] = None,
    ) -> bool:
        records = self.store.load_records()
        target = None
        for r in records:
            if r.record_id == record_id:
                target = r
                break
        if target is None:
            return False

        old_status = target.status
        target.status = new_status
        if manual_note is not None and manual_note:
            old_note = target.manual_note
            target.manual_note = manual_note
            self.store.append_audit_log(AuditLog(
                record_id=record_id,
                field_name="manual_note",
                old_value=old_note,
                new_value=manual_note,
                reason=reason,
                operator=operator,
            ))

        self.store.append_audit_log(AuditLog(
            record_id=record_id,
            field_name="status",
            old_value=old_status,
            new_value=new_status,
            reason=reason,
            operator=operator,
        ))

        self.store.save_records(records)
        return True

    def get_duplicate_details(self) -> List[Dict]:
        issues = self.store.load_duplicate_issues()
        records = {r.record_id: r for r in self.store.load_records()}
        result = []
        for issue in issues:
            recs = [records[rid] for rid in issue.affected_records if rid in records]
            result.append({
                "sample_bottle_id": issue.sample_bottle_id,
                "reason": issue.reason,
                "records": [r.to_row() for r in recs],
            })
        return result
