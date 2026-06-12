from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import uuid


def make_run_id() -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    return ts


@dataclass
class ComplaintRecord:
    complaint_id: str
    location: str
    photo_urls: List[str] = field(default_factory=list)
    photo_remarks: str = ""
    ramp_exist: Optional[bool] = None
    ramp_remarks: str = ""
    initial_score: Optional[int] = None
    current_score: Optional[int] = None
    suggestions: List[str] = field(default_factory=list)
    status: str = "new"
    old_caliber_applied: bool = False
    review_needed: bool = False
    review_by: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    version: int = 1
    operation_log: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ComplaintRecord":
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})

    def snapshot_fields(self) -> Dict[str, Any]:
        return {
            "photo_remarks": self.photo_remarks,
            "ramp_exist": self.ramp_exist,
            "ramp_remarks": self.ramp_remarks,
            "current_score": self.current_score,
            "initial_score": self.initial_score,
            "suggestions": self.suggestions.copy(),
            "status": self.status,
            "review_needed": self.review_needed,
            "old_caliber_applied": self.old_caliber_applied,
        }

    def add_log(self, operator: str, action: str, details: str = "",
                before: Optional[Dict[str, Any]] = None,
                after: Optional[Dict[str, Any]] = None,
                reason: str = "",
                run_id: str = ""):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "action": action,
            "details": details,
            "version": self.version,
            "run_id": run_id,
        }
        if before is not None:
            entry["before"] = before
        if after is not None:
            entry["after"] = after
        if reason:
            entry["reason"] = reason
        self.operation_log.append(entry)
        self.version += 1
        self.updated_at = datetime.now().isoformat()


@dataclass
class ProcessingRun:
    run_id: str
    run_time: str
    records_processed: List[str]
    changes_made: List[Dict[str, Any]]
    run_command: str
    before_snapshots: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    after_snapshots: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProcessingRun":
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
