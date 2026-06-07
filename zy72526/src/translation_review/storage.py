from __future__ import annotations
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Iterator
from .models import (
    TranslationRecord,
    ManualChange,
    ValidationIssue,
    WorkflowLog,
    RecordStatus,
    WorkflowStep,
)


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.records_dir = self.data_dir / "records"
        self.issues_dir = self.data_dir / "issues"
        self.logs_dir = self.data_dir / "workflow_logs"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for d in [self.records_dir, self.issues_dir, self.logs_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def _record_path(self, record_id: str) -> Path:
        return self.records_dir / f"{record_id}.json"

    def _issue_path(self, issue_id: str) -> Path:
        return self.issues_dir / f"{issue_id}.json"

    def _log_path(self, log_id: str) -> Path:
        return self.logs_dir / f"{log_id}.json"

    def save_record(self, record: TranslationRecord) -> None:
        record.updated_at = datetime.now()
        path = self._record_path(record.record_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record.model_dump(), f, ensure_ascii=False, default=str)

    def get_record(self, record_id: str) -> Optional[TranslationRecord]:
        path = self._record_path(record_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return TranslationRecord(**data)

    def list_records(self) -> List[TranslationRecord]:
        records = []
        for path in self.records_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            records.append(TranslationRecord(**data))
        return sorted(records, key=lambda r: r.created_at, reverse=True)

    def find_by_sample_no(self, sample_no: str) -> List[TranslationRecord]:
        return [r for r in self.list_records() if r.sample_no == sample_no]

    def find_by_ticket_id(self, ticket_id: str) -> List[TranslationRecord]:
        return [r for r in self.list_records() if r.feedback_ticket.ticket_id == ticket_id]

    def find_by_batch_no(self, batch_no: str) -> List[TranslationRecord]:
        return [r for r in self.list_records() if r.import_batch_no == batch_no]

    def save_issue(self, issue: ValidationIssue) -> None:
        path = self._issue_path(issue.issue_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(issue.model_dump(), f, ensure_ascii=False, default=str)

    def get_issue(self, issue_id: str) -> Optional[ValidationIssue]:
        path = self._issue_path(issue_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ValidationIssue(**data)

    def list_issues(self, record_id: Optional[str] = None, resolved: Optional[bool] = None) -> List[ValidationIssue]:
        issues = []
        for path in self.issues_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            issue = ValidationIssue(**data)
            if record_id and issue.record_id != record_id:
                continue
            if resolved is not None and issue.resolved != resolved:
                continue
            issues.append(issue)
        return sorted(issues, key=lambda i: i.detected_at, reverse=True)

    def save_workflow_log(self, log: WorkflowLog) -> None:
        path = self._log_path(log.log_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(log.model_dump(), f, ensure_ascii=False, default=str)

    def list_workflow_logs(self, record_id: Optional[str] = None) -> List[WorkflowLog]:
        logs = []
        for path in self.logs_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            log = WorkflowLog(**data)
            if record_id and log.record_id != record_id:
                continue
            logs.append(log)
        return sorted(logs, key=lambda l: l.created_at)

    def add_manual_change(self, record_id: str, change: ManualChange) -> None:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.manual_changes.append(change)
        self.save_record(record)
