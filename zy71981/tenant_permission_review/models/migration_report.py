from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional
from uuid import uuid4


@dataclass
class MigrationReport:
    tenant_id: str
    migration_batch_id: str
    total_records: int
    success_count: int
    report_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    failed_count: int = 0
    duplicate_count: int = 0
    late_arrival_count: int = 0
    manual_corrected_count: int = 0
    failed_record_ids: List[str] = field(default_factory=list)
    duplicate_record_ids: List[str] = field(default_factory=list)
    late_arrival_ids: List[str] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)

    def add_issue(self, issue: str):
        self.issues.append(issue)

    def to_dict(self):
        return {
            "report_id": self.report_id,
            "tenant_id": self.tenant_id,
            "migration_batch_id": self.migration_batch_id,
            "timestamp": self.timestamp.isoformat(),
            "total_records": self.total_records,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "duplicate_count": self.duplicate_count,
            "late_arrival_count": self.late_arrival_count,
            "manual_corrected_count": self.manual_corrected_count,
            "failed_record_ids": self.failed_record_ids,
            "duplicate_record_ids": self.duplicate_record_ids,
            "late_arrival_ids": self.late_arrival_ids,
            "summary": self.summary,
            "issues": self.issues,
        }
