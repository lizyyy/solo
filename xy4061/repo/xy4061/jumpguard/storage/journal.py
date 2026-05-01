import os
import json
import uuid
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any


@dataclass
class JournalEntry:
    entry_id: str
    entry_type: str
    operation: str
    timestamp: str
    user: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    undo_info: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "entry_type": self.entry_type,
            "operation": self.operation,
            "timestamp": self.timestamp,
            "user": self.user,
            "description": self.description,
            "details": self.details,
            "undo_info": self.undo_info,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JournalEntry":
        return cls(
            entry_id=data.get("entry_id", ""),
            entry_type=data.get("entry_type", ""),
            operation=data.get("operation", ""),
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            user=data.get("user", "system"),
            description=data.get("description", ""),
            details=data.get("details", {}),
            undo_info=data.get("undo_info"),
        )


@dataclass
class AuditLog:
    log_id: str
    audit_period_start: str
    audit_period_end: str
    generated_at: str
    operator: str
    summary: Dict[str, Any] = field(default_factory=dict)
    journal_entries: List[str] = field(default_factory=list)
    quarantine_items: List[str] = field(default_factory=list)
    remediation_actions: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "audit_period_start": self.audit_period_start,
            "audit_period_end": self.audit_period_end,
            "generated_at": self.generated_at,
            "operator": self.operator,
            "summary": self.summary,
            "journal_entries": self.journal_entries,
            "quarantine_items": self.quarantine_items,
            "remediation_actions": self.remediation_actions,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditLog":
        return cls(
            log_id=data.get("log_id", ""),
            audit_period_start=data.get("audit_period_start", ""),
            audit_period_end=data.get("audit_period_end", ""),
            generated_at=data.get("generated_at", datetime.now().isoformat()),
            operator=data.get("operator", "system"),
            summary=data.get("summary", {}),
            journal_entries=data.get("journal_entries", []),
            quarantine_items=data.get("quarantine_items", []),
            remediation_actions=data.get("remediation_actions", []),
        )


class JournalManager:
    JOURNAL_FILENAME = "journal.json"
    AUDIT_LOGS_DIR = "audit_logs"

    TYPE_IMPORT = "import"
    TYPE_CHECK = "check"
    TYPE_PLAN = "plan"
    TYPE_APPLY = "apply"
    TYPE_UNDO = "undo"
    TYPE_REPORT = "report"

    OPERATION_CREATE = "create"
    OPERATION_UPDATE = "update"
    OPERATION_DELETE = "delete"
    OPERATION_IMPORT = "import"
    OPERATION_SCAN = "scan"
    OPERATION_EXECUTE = "execute"
    OPERATION_REVERT = "revert"

    def __init__(self, state_dir: str):
        self.state_dir = os.path.abspath(state_dir)
        self.audit_logs_dir = os.path.join(self.state_dir, self.AUDIT_LOGS_DIR)
        self._entries: List[JournalEntry] = []

    def _ensure_dirs(self) -> None:
        os.makedirs(self.state_dir, exist_ok=True)
        os.makedirs(self.audit_logs_dir, exist_ok=True)

    @property
    def entries(self) -> List[JournalEntry]:
        if not self._entries:
            self._load()
        return self._entries

    def create_entry(
        self,
        entry_type: str,
        operation: str,
        description: str,
        details: Optional[Dict[str, Any]] = None,
        user: str = "system",
        undo_info: Optional[Dict[str, Any]] = None,
    ) -> JournalEntry:
        entry = JournalEntry(
            entry_id=str(uuid.uuid4()),
            entry_type=entry_type,
            operation=operation,
            timestamp=datetime.now().isoformat(),
            user=user,
            description=description,
            details=details or {},
            undo_info=undo_info,
        )
        self._entries.append(entry)
        self._save()
        return entry

    def log_import(
        self,
        source_type: str,
        source_file: str,
        records_count: int,
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_IMPORT,
            operation=self.OPERATION_IMPORT,
            description=f"Imported {source_type} data from {source_file}",
            details={
                "source_type": source_type,
                "source_file": source_file,
                "records_count": records_count,
            },
            user=user,
        )

    def log_check(
        self,
        issues_found: int,
        by_rule: Dict[str, int],
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_CHECK,
            operation=self.OPERATION_SCAN,
            description=f"Check completed: {issues_found} issues found",
            details={
                "issues_found": issues_found,
                "by_rule": by_rule,
            },
            user=user,
        )

    def log_plan(
        self,
        plan_items: List[Dict[str, Any]],
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_PLAN,
            operation=self.OPERATION_CREATE,
            description=f"Generated remediation plan with {len(plan_items)} actions",
            details={
                "plan_items_count": len(plan_items),
                "plan_items": plan_items,
            },
            user=user,
        )

    def log_apply(
        self,
        action: str,
        affected_entity: str,
        undo_info: Dict[str, Any],
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_APPLY,
            operation=self.OPERATION_EXECUTE,
            description=f"Applied remediation: {action} on {affected_entity}",
            details={
                "action": action,
                "affected_entity": affected_entity,
            },
            user=user,
            undo_info=undo_info,
        )

    def log_undo(
        self,
        original_entry_id: str,
        action: str,
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_UNDO,
            operation=self.OPERATION_REVERT,
            description=f"Undid action from entry {original_entry_id}: {action}",
            details={
                "original_entry_id": original_entry_id,
            },
            user=user,
        )

    def log_report(
        self,
        report_type: str,
        output_path: str,
        user: str = "system",
    ) -> JournalEntry:
        return self.create_entry(
            entry_type=self.TYPE_REPORT,
            operation=self.OPERATION_CREATE,
            description=f"Generated {report_type} report at {output_path}",
            details={
                "report_type": report_type,
                "output_path": output_path,
            },
            user=user,
        )

    def _save(self) -> None:
        self._ensure_dirs()
        journal_path = os.path.join(self.state_dir, self.JOURNAL_FILENAME)
        
        data = {
            "entries": [e.to_dict() for e in self._entries],
            "updated_at": datetime.now().isoformat(),
        }

        with open(journal_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load(self) -> None:
        journal_path = os.path.join(self.state_dir, self.JOURNAL_FILENAME)
        
        if not os.path.exists(journal_path):
            self._entries = []
            return

        with open(journal_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._entries = [JournalEntry.from_dict(e) for e in data.get("entries", [])]

    def get_entry_by_id(self, entry_id: str) -> Optional[JournalEntry]:
        for entry in self.entries:
            if entry.entry_id == entry_id:
                return entry
        return None

    def get_entries_by_type(self, entry_type: str) -> List[JournalEntry]:
        return [e for e in self.entries if e.entry_type == entry_type]

    def get_recent_entries(self, limit: int = 10) -> List[JournalEntry]:
        entries = sorted(self.entries, key=lambda e: e.timestamp, reverse=True)
        return entries[:limit]

    def create_audit_log(
        self,
        period_start: str,
        period_end: str,
        operator: str,
        summary: Dict[str, Any],
        entry_ids: List[str],
        quarantine_item_ids: List[str],
        remediation_actions: List[Dict[str, Any]],
    ) -> str:
        self._ensure_dirs()
        
        log_id = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        audit_log = AuditLog(
            log_id=log_id,
            audit_period_start=period_start,
            audit_period_end=period_end,
            generated_at=datetime.now().isoformat(),
            operator=operator,
            summary=summary,
            journal_entries=entry_ids,
            quarantine_items=quarantine_item_ids,
            remediation_actions=remediation_actions,
        )

        log_path = os.path.join(self.audit_logs_dir, f"{log_id}.json")
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(audit_log.to_dict(), f, ensure_ascii=False, indent=2)

        return log_id

    def list_audit_logs(self) -> List[str]:
        if not os.path.exists(self.audit_logs_dir):
            return []
        return sorted([f for f in os.listdir(self.audit_logs_dir) if f.endswith(".json")])

    def get_audit_log(self, log_id: str) -> Optional[AuditLog]:
        log_path = os.path.join(self.audit_logs_dir, f"{log_id}.json")
        if not os.path.exists(log_path):
            log_path = os.path.join(self.audit_logs_dir, log_id)
            if not os.path.exists(log_path):
                return None

        with open(log_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return AuditLog.from_dict(data)
