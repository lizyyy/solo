from typing import List, Optional
from datetime import datetime, date
from collections import Counter

from app.models import FaultClassification, FaultType, FaultStatus
from app.utils.storage import DataStorage


class FaultQuery:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def filter_faults(
        self,
        assignee: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        fault_type: Optional[str] = None,
        station_id: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[FaultClassification]:
        faults = self.storage.load_all_faults()
        filtered = faults

        if assignee:
            filtered = [f for f in filtered if f.assignee == assignee]

        if start_date:
            filtered = [f for f in filtered if f.event_time.date() >= start_date]

        if end_date:
            filtered = [f for f in filtered if f.event_time.date() <= end_date]

        if status:
            filtered = [f for f in filtered if f.status == status]

        if fault_type:
            filtered = [f for f in filtered if f.fault_type == fault_type]

        if station_id:
            filtered = [f for f in filtered if f.station_id == station_id]

        if severity:
            filtered = [f for f in filtered if f.severity == severity]

        return filtered

    def get_summary(self, faults: Optional[List[FaultClassification]] = None) -> dict:
        if faults is None:
            faults = self.storage.load_all_faults()

        total = len(faults)

        status_counts = Counter(f.status for f in faults)
        type_counts = Counter(f.fault_type for f in faults)
        severity_counts = Counter(f.severity for f in faults)
        station_counts = Counter(f.station_id for f in faults)

        by_assignee = Counter(
            f.assignee for f in faults if f.assignee
        )

        pending_review = sum(1 for f in faults if f.status == FaultStatus.PENDING_REVIEW)
        confirmed = sum(1 for f in faults if f.status == FaultStatus.CONFIRMED)
        resolved = sum(1 for f in faults if f.status == FaultStatus.RESOLVED)

        high_confidence = sum(1 for f in faults if f.confidence >= 0.8)
        low_confidence = sum(1 for f in faults if f.confidence < 0.5)

        return {
            "total": total,
            "by_status": dict(status_counts),
            "by_type": dict(type_counts),
            "by_severity": dict(severity_counts),
            "by_station": dict(station_counts),
            "by_assignee": dict(by_assignee),
            "pending_review": pending_review,
            "confirmed": confirmed,
            "resolved": resolved,
            "high_confidence": high_confidence,
            "low_confidence": low_confidence,
        }

    def get_bad_records_summary(self) -> dict:
        bad_records = self.storage.load_all_bad_records()
        source_counts = Counter(br.source for br in bad_records)
        status_counts = Counter(br.status for br in bad_records)

        return {
            "total": len(bad_records),
            "by_source": dict(source_counts),
            "by_status": dict(status_counts),
            "records": bad_records,
        }

    def get_fault_by_id(self, fault_id: str) -> Optional[FaultClassification]:
        faults = self.storage.load_all_faults()
        for fault in faults:
            if fault.fault_id == fault_id:
                return fault
        return None

    def confirm_fault(self, fault_id: str, notes: str = None) -> bool:
        fault = self.storage.update_fault_status(fault_id, FaultStatus.CONFIRMED, notes)
        return fault is not None

    def resolve_fault(self, fault_id: str, notes: str = None) -> bool:
        fault = self.storage.update_fault_status(fault_id, FaultStatus.RESOLVED, notes)
        return fault is not None

    def dismiss_fault(self, fault_id: str, notes: str = None) -> bool:
        fault = self.storage.update_fault_status(fault_id, FaultStatus.DISMISSED, notes)
        return fault is not None
