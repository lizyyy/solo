from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any


@dataclass
class HostEntry:
    line_number: int
    hostname: str
    port: int = 22
    tags: List[str] = field(default_factory=list)
    raw_line: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_number": self.line_number,
            "hostname": self.hostname,
            "port": self.port,
            "tags": self.tags,
            "raw_line": self.raw_line,
        }


@dataclass
class BadEntry:
    line_number: int
    raw_line: str
    error_reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_number": self.line_number,
            "raw_line": self.raw_line,
            "error_reason": self.error_reason,
        }


@dataclass
class ScanResult:
    host: HostEntry
    success: bool
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    scan_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            **self.host.to_dict(),
            "success": self.success,
            "latency_ms": self.latency_ms,
            "error_message": self.error_message,
            "scan_time": self.scan_time.isoformat(),
        }


@dataclass
class ScanSummary:
    total: int
    successful: int
    failed: int
    bad_entries: int
    avg_latency_ms: Optional[float]
    scan_duration_seconds: float
    results: List[ScanResult]
    bad_entries_list: List[BadEntry]
    tags_summary: Dict[str, Dict[str, int]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "successful": self.successful,
            "failed": self.failed,
            "bad_entries": self.bad_entries,
            "avg_latency_ms": self.avg_latency_ms,
            "scan_duration_seconds": self.scan_duration_seconds,
            "results": [r.to_dict() for r in self.results],
            "bad_entries": [b.to_dict() for b in self.bad_entries_list],
            "tags_summary": self.tags_summary,
        }
