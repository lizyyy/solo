from dataclasses import dataclass, field
from typing import List, Dict
from datetime import datetime
from .config_item import DriftRecord, ReviewStatus
from .source_tracker import SourceTracker


@dataclass
class AuditSummary:
    total_records: int = 0
    drifted_records: int = 0
    exempted_records: int = 0
    expired_exemptions: int = 0
    pending_review: int = 0
    approved_exemptions: int = 0
    rejected_exemptions: int = 0
    no_exemption: int = 0
    bad_rows_count: int = 0
    audit_time: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class AuditResult:
    drift_records: List[DriftRecord] = field(default_factory=list)
    source_tracker: SourceTracker = field(default_factory=SourceTracker)
    summary: AuditSummary = field(default_factory=AuditSummary)
    run_id: str = field(default_factory=lambda: datetime.now().strftime("%Y%m%d_%H%M%S"))

    def sort_records(self) -> None:
        self.drift_records.sort(key=lambda r: (
            r.config_item.service_name,
            r.config_item.config_key
        ))

    def get_records_by_status(self, status: ReviewStatus) -> List[DriftRecord]:
        return [r for r in self.drift_records if r.review_status == status]

    def get_expired_exemptions(self) -> List[DriftRecord]:
        return [r for r in self.drift_records if r.is_exemption_expired]
