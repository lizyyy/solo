from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    Record, RecordStatus, Source, SourceType, AuditLog
)


class RecordProcessor:
    def __init__(self, time_tolerance_minutes: int = 1):
        self.time_tolerance = timedelta(minutes=time_tolerance_minutes)
        self.records: Dict[str, Record] = {}

    def load_records(self, records: List[Record]):
        for record in records:
            self.records[record.id] = record

    def get_all_records(self) -> List[Record]:
        return list(self.records.values())

    def get_record_by_id(self, record_id: str) -> Optional[Record]:
        return self.records.get(record_id)

    def get_records_by_status(self, status: RecordStatus) -> List[Record]:
        return [r for r in self.records.values() if r.status == status]

    def get_pending_records(self) -> List[Record]:
        return self.get_records_by_status(RecordStatus.PENDING)

    def _is_time_overlap(self, r1: Record, r2: Record) -> bool:
        return r1.start_time < r2.end_time and r2.start_time < r1.end_time

    def _is_time_near_duplicate(self, r1: Record, r2: Record) -> bool:
        start_diff = abs((r1.start_time - r2.start_time).total_seconds())
        end_diff = abs((r1.end_time - r2.end_time).total_seconds())
        return (start_diff <= self.time_tolerance.total_seconds() and
                end_diff <= self.time_tolerance.total_seconds())

    def find_duplicates(self) -> List[Tuple[Record, List[Record]]]:
        duplicates = []
        processed = set()
        
        records_by_sat = defaultdict(list)
        for r in self.records.values():
            records_by_sat[r.satellite].append(r)
        
        for sat, records in records_by_sat.items():
            for i, r1 in enumerate(records):
                if r1.id in processed:
                    continue
                dups = []
                for r2 in records[i+1:]:
                    if r2.id in processed:
                        continue
                    if (self._is_time_near_duplicate(r1, r2) and
                            r1.content_hash() == r2.content_hash()):
                        dups.append(r2)
                        processed.add(r2.id)
                if dups:
                    duplicates.append((r1, dups))
                    processed.add(r1.id)
        
        return duplicates

    def mark_duplicates(self, actor: str = "system") -> int:
        duplicate_groups = self.find_duplicates()
        count = 0
        
        for primary, duplicates in duplicate_groups:
            for dup in duplicates:
                self._update_status(
                    dup, RecordStatus.DUPLICATE, actor,
                    reason=f"重复记录，主记录ID: {primary.id}",
                    details={"primary_id": primary.id}
                )
                dup.duplicate_of = primary.id
                count += 1
        
        return count

    def find_time_conflicts(self) -> List[Tuple[Record, Record]]:
        conflicts = []
        records_by_sat = defaultdict(list)
        
        for r in self.records.values():
            if r.status not in [RecordStatus.DUPLICATE, RecordStatus.DISCARDED]:
                records_by_sat[r.satellite].append(r)
        
        for sat, records in records_by_sat.items():
            records_sorted = sorted(records, key=lambda r: r.start_time)
            for i in range(len(records_sorted)):
                for j in range(i + 1, len(records_sorted)):
                    r1, r2 = records_sorted[i], records_sorted[j]
                    if r2.start_time >= r1.end_time:
                        break
                    if self._is_time_overlap(r1, r2):
                        if (r1.source.type != r2.source.type or
                                r1.source.system != r2.source.system):
                            conflicts.append((r1, r2))
        
        return conflicts

    def detect_late_arrivals(self, cutoff_hours: int = 24) -> List[Record]:
        late_records = []
        cutoff = datetime.now() - timedelta(hours=cutoff_hours)
        
        for record in self.records.values():
            if (record.source.import_time > cutoff and
                    record.end_time < cutoff and
                    record.status == RecordStatus.PENDING):
                late_records.append(record)
        
        return late_records

    def mark_late_arrivals(self, cutoff_hours: int = 24,
                           actor: str = "system") -> int:
        late_records = self.detect_late_arrivals(cutoff_hours)
        for record in late_records:
            self._update_status(
                record, RecordStatus.LATE_ARRIVAL, actor,
                reason=f"晚到记录，截止时间前 {cutoff_hours} 小时"
            )
        return len(late_records)

    def _update_status(self, record: Record, new_status: RecordStatus,
                       actor: str, reason: str = "",
                       details: Optional[Dict] = None):
        old_status = record.status
        record.status = new_status
        if reason and new_status == RecordStatus.PENDING:
            record.pending_reason = reason
        
        audit_log = AuditLog(
            timestamp=datetime.now(),
            actor=actor,
            action="status_change",
            from_status=old_status,
            to_status=new_status,
            reason=reason,
            details=details or {}
        )
        record.add_audit_log(audit_log)

    def classify_record(self, record: Record, actor: str = "system"):
        if record.status != RecordStatus.PENDING:
            return
        
        has_time_conflict = any(
            self._is_time_overlap(record, r)
            for r in self.records.values()
            if r.id != record.id and r.satellite == record.satellite
            and r.status not in [RecordStatus.DUPLICATE, RecordStatus.DISCARDED]
        )
        
        if has_time_conflict:
            self._update_status(
                record, RecordStatus.PENDING, actor,
                reason="时间窗口存在重叠，需要人工确认"
            )
        else:
            self._update_status(
                record, RecordStatus.NORMAL, actor,
                reason="自动校验通过"
            )

    def process_new_record(self, record: Record, actor: str = "system") -> Record:
        if record.id in self.records:
            existing = self.records[record.id]
            if record.content_hash() == existing.content_hash():
                return existing
        
        self.records[record.id] = record
        
        audit_log = AuditLog(
            timestamp=datetime.now(),
            actor=actor,
            action="import",
            to_status=record.status,
            reason="新记录导入",
            details={"source_file": record.source.file}
        )
        record.add_audit_log(audit_log)
        
        return record

    def manual_correct(self, record_id: str, new_content: Dict,
                       actor: str, reason: str) -> Optional[Record]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        old_content = record.content.copy()
        record.content.update(new_content)
        
        self._update_status(
            record, RecordStatus.MANUAL_CORRECTED, actor,
            reason=reason,
            details={"old_content": old_content, "new_content": new_content}
        )
        
        return record

    def resolve_pending(self, record_id: str, actor: str,
                        resolution: str) -> Optional[Record]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        self._update_status(
            record, RecordStatus.RESOLVED, actor,
            reason=resolution
        )
        
        return record

    def discard_record(self, record_id: str, actor: str,
                       reason: str) -> Optional[Record]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        self._update_status(
            record, RecordStatus.DISCARDED, actor,
            reason=reason
        )
        
        return record

    def find_window_overlaps(self) -> Dict[str, List[Tuple[Record, Record]]]:
        overlaps = defaultdict(list)
        conflicts = self.find_time_conflicts()
        for r1, r2 in conflicts:
            overlaps[r1.satellite].append((r1, r2))
        return dict(overlaps)
