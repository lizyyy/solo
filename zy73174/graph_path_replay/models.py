from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Any


class RowStatus(str, Enum):
    PROCESSED = "processed"
    SKIPPED = "skipped"
    BAD = "bad"


class AnomalyStatus(str, Enum):
    OPEN = "open"
    SUPPLEMENTED = "supplemented"
    REJUDGED = "rejudged"
    RESOLVED = "resolved"


class SortStability(str, Enum):
    STABLE = "stable"
    UNSTABLE = "unstable"
    UNKNOWN = "unknown"


@dataclass
class VersionedField:
    value: Any
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    author: str = "system"
    note: str = ""

    def to_dict(self) -> dict:
        return {
            "value": self.value,
            "timestamp": self.timestamp,
            "author": self.author,
            "note": self.note,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "VersionedField":
        return cls(
            value=d["value"],
            timestamp=d.get("timestamp", ""),
            author=d.get("author", "system"),
            note=d.get("note", ""),
        )


@dataclass
class HistoryField:
    history: list[VersionedField] = field(default_factory=list)

    def append(self, value: Any, author: str = "system", note: str = "") -> None:
        self.history.append(VersionedField(value=value, author=author, note=note))

    def latest(self) -> Optional[VersionedField]:
        return self.history[-1] if self.history else None

    def all_values(self) -> list:
        return [vf.value for vf in self.history]

    def to_dict(self) -> dict:
        return {"history": [vf.to_dict() for vf in self.history]}

    @classmethod
    def from_dict(cls, d: dict) -> "HistoryField":
        return cls(history=[VersionedField.from_dict(v) for v in d.get("history", [])])


@dataclass
class QuestionItem:
    question_id: str
    title: str
    path_params: dict
    remark: HistoryField = field(default_factory=HistoryField)
    screenshots: HistoryField = field(default_factory=HistoryField)
    tags: list[str] = field(default_factory=list)
    sort_key: Any = None

    def to_dict(self) -> dict:
        return {
            "question_id": self.question_id,
            "title": self.title,
            "path_params": self.path_params,
            "remark": self.remark.to_dict(),
            "screenshots": self.screenshots.to_dict(),
            "tags": self.tags,
            "sort_key": self.sort_key,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "QuestionItem":
        return cls(
            question_id=d["question_id"],
            title=d["title"],
            path_params=d.get("path_params", {}),
            remark=HistoryField.from_dict(d.get("remark", {"history": []})),
            screenshots=HistoryField.from_dict(d.get("screenshots", {"history": []})),
            tags=d.get("tags", []),
            sort_key=d.get("sort_key"),
        )


@dataclass
class ReplayRow:
    line_number: int
    raw_line: str
    status: RowStatus
    question: Optional[QuestionItem] = None
    error_message: str = ""
    skip_reason: str = ""

    def to_dict(self) -> dict:
        return {
            "line_number": self.line_number,
            "raw_line": self.raw_line,
            "status": self.status.value,
            "question": self.question.to_dict() if self.question else None,
            "error_message": self.error_message,
            "skip_reason": self.skip_reason,
        }


@dataclass
class SortDetection:
    stable: SortStability
    before_order: list[str]
    after_order: list[str]
    diff_indices: list[tuple[int, str, str]] = field(default_factory=list)
    action_suggestion: str = ""

    def to_dict(self) -> dict:
        return {
            "stable": self.stable.value,
            "before_order": self.before_order,
            "after_order": self.after_order,
            "diff_indices": list(self.diff_indices),
            "action_suggestion": self.action_suggestion,
        }


@dataclass
class AnomalyItem:
    anomaly_id: str
    question_id: str
    title: str
    anomaly_type: str
    description: str
    status: AnomalyStatus = AnomalyStatus.OPEN
    params_snapshot: dict = field(default_factory=dict)
    operation_log: list[dict] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def add_operation(self, op_type: str, detail: str, operator: str = "duty") -> None:
        self.operation_log.append({
            "op_type": op_type,
            "detail": detail,
            "operator": operator,
            "timestamp": datetime.now().isoformat(timespec="seconds"),
        })

    def to_dict(self) -> dict:
        return {
            "anomaly_id": self.anomaly_id,
            "question_id": self.question_id,
            "title": self.title,
            "anomaly_type": self.anomaly_type,
            "description": self.description,
            "status": self.status.value,
            "params_snapshot": self.params_snapshot,
            "operation_log": self.operation_log,
            "created_at": self.created_at,
        }


@dataclass
class ReplaySummary:
    param_version: str
    total_rows: int = 0
    processed_rows: int = 0
    skipped_rows: int = 0
    bad_rows: int = 0
    break_down: list[ReplayRow] = field(default_factory=list)
    anomalies: list[AnomalyItem] = field(default_factory=list)
    sort_detection: Optional[SortDetection] = None
    started_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    finished_at: str = ""

    def mark_finished(self) -> None:
        self.finished_at = datetime.now().isoformat(timespec="seconds")

    def to_dict(self) -> dict:
        return {
            "param_version": self.param_version,
            "total_rows": self.total_rows,
            "processed_rows": self.processed_rows,
            "skipped_rows": self.skipped_rows,
            "bad_rows": self.bad_rows,
            "break_down": [r.to_dict() for r in self.break_down],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "sort_detection": self.sort_detection.to_dict() if self.sort_detection else None,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)
