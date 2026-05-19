from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class EvidenceStatus(Enum):
    ALIVE = "alive"
    DEAD = "dead"
    UNKNOWN = "unknown"
    ERROR = "error"


class SourceType(Enum):
    CATALOG = "catalog"
    REPOSITORY = "repository"
    ALERT = "alert"


@dataclass
class SourceLocation:
    file_path: str
    line_number: Optional[int] = None
    column: Optional[int] = None
    raw_content: Optional[str] = None

    def __str__(self) -> str:
        if self.line_number:
            return f"{self.file_path}:{self.line_number}"
        return self.file_path


@dataclass
class ServiceEntry:
    service_name: str
    repository: Optional[str] = None
    owners: List[str] = field(default_factory=list)
    alert_rules: List[str] = field(default_factory=list)
    source: Optional[SourceLocation] = None
    is_valid: bool = True
    parse_error: Optional[str] = None
    extra_fields: Dict[str, Any] = field(default_factory=dict)

    def get_stable_id(self) -> str:
        return self.service_name.strip().lower()


@dataclass
class EvidenceResult:
    source_type: SourceType
    status: EvidenceStatus
    message: str = ""
    checked_at: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)
    error: Optional[Exception] = None


@dataclass
class OrphanReport:
    service_entry: ServiceEntry
    repository_evidence: Optional[EvidenceResult] = None
    alert_evidence: Optional[EvidenceResult] = None
    owner_evidence: Dict[str, List[SourceType]] = field(default_factory=dict)
    is_orphan: bool = False
    orphan_reasons: List[str] = field(default_factory=list)
    overall_status: EvidenceStatus = EvidenceStatus.UNKNOWN

    def get_stable_sort_key(self) -> tuple:
        return (
            self.overall_status.value,
            self.service_entry.get_stable_id(),
        )
