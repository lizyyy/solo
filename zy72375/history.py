import uuid
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from models import HistoryEntry, ChangeType, UniformZoneRecord, AuditLog


class HistoryManager:
    def __init__(self, storage_path: str = "data/history.json"):
        self.storage_path = storage_path
        self.entries: Dict[str, HistoryEntry] = {}
        self.audit_logs: List[AuditLog] = []
        self._load()

    def _load(self):
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for entry_data in data.get("entries", []):
                    entry = HistoryEntry(
                        entry_id=entry_data["entry_id"],
                        uniform_zone_id=entry_data["uniform_zone_id"],
                        change_type=ChangeType(entry_data["change_type"]),
                        before_value=entry_data.get("before_value"),
                        after_value=entry_data.get("after_value"),
                        operator=entry_data.get("operator"),
                        timestamp=entry_data.get("timestamp", datetime.now().isoformat()),
                        reason=entry_data.get("reason"),
                        evidence_ref=entry_data.get("evidence_ref"),
                        command_used=entry_data.get("command_used"),
                    )
                    self.entries[entry.entry_id] = entry
                for log_data in data.get("audit_logs", []):
                    log = AuditLog(
                        log_id=log_data["log_id"],
                        command=log_data["command"],
                        parameters=log_data.get("parameters", {}),
                        result_summary=log_data.get("result_summary", ""),
                        timestamp=log_data.get("timestamp", datetime.now().isoformat()),
                        operator=log_data.get("operator"),
                    )
                    self.audit_logs.append(log)
        except FileNotFoundError:
            pass

    def _save(self):
        import os
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        data = {
            "entries": [e.to_dict() for e in self.entries.values()],
            "audit_logs": [l.to_dict() for l in self.audit_logs],
        }
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def create_entry(
        self,
        uniform_zone_id: str,
        change_type: ChangeType,
        before_value: Optional[Dict[str, Any]] = None,
        after_value: Optional[Dict[str, Any]] = None,
        operator: Optional[str] = None,
        reason: Optional[str] = None,
        evidence_ref: Optional[str] = None,
        command_used: Optional[str] = None,
    ) -> HistoryEntry:
        entry_id = str(uuid.uuid4())
        entry = HistoryEntry(
            entry_id=entry_id,
            uniform_zone_id=uniform_zone_id,
            change_type=change_type,
            before_value=before_value,
            after_value=after_value,
            operator=operator,
            reason=reason,
            evidence_ref=evidence_ref,
            command_used=command_used,
        )
        self.entries[entry_id] = entry
        self._save()
        return entry

    def add_audit_log(
        self,
        command: str,
        parameters: Dict[str, Any],
        result_summary: str,
        operator: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            command=command,
            parameters=parameters,
            result_summary=result_summary,
            operator=operator,
        )
        self.audit_logs.append(log)
        self._save()
        return log

    def get_entry(self, entry_id: str) -> Optional[HistoryEntry]:
        return self.entries.get(entry_id)

    def get_uniform_zone_history(self, uniform_zone_id: str) -> List[HistoryEntry]:
        return [
            e for e in self.entries.values()
            if e.uniform_zone_id == uniform_zone_id
        ]

    def compare_changes(self, entry_id: str) -> Dict[str, Any]:
        entry = self.get_entry(entry_id)
        if not entry:
            return {}

        before = entry.before_value or {}
        after = entry.after_value or {}

        diff = {
            "entry_id": entry_id,
            "change_type": entry.change_type.value,
            "timestamp": entry.timestamp,
            "operator": entry.operator,
            "reason": entry.reason,
            "added": {},
            "removed": {},
            "modified": {},
        }

        all_keys = set(before.keys()) | set(after.keys())
        for key in all_keys:
            if key not in before and key in after:
                diff["added"][key] = after[key]
            elif key in before and key not in after:
                diff["removed"][key] = before[key]
            elif before[key] != after[key]:
                diff["modified"][key] = {
                    "before": before[key],
                    "after": after[key],
                }

        return diff

    def generate_replay_commands(self, uniform_zone_id: str) -> List[str]:
        history = sorted(
            self.get_uniform_zone_history(uniform_zone_id),
            key=lambda e: e.timestamp,
        )

        commands = []
        for entry in history:
            if entry.command_used:
                commands.append(
                    f"# [{entry.timestamp}] {entry.change_type.value} "
                    f"- {entry.operator or '未知'}: {entry.reason or ''}"
                )
                commands.append(entry.command_used)

        return commands

    def generate_audit_summary(self, uniform_zone_id: str) -> Dict[str, Any]:
        history = self.get_uniform_zone_history(uniform_zone_id)

        change_types = {}
        operators = {}
        for entry in history:
            ct = entry.change_type.value
            change_types[ct] = change_types.get(ct, 0) + 1
            op = entry.operator or "未知"
            operators[op] = operators.get(op, 0) + 1

        return {
            "uniform_zone_id": uniform_zone_id,
            "total_changes": len(history),
            "change_types": change_types,
            "operators": operators,
            "first_change": min(h.timestamp for h in history) if history else None,
            "last_change": max(h.timestamp for h in history) if history else None,
        }

    def get_all_entries(self) -> List[HistoryEntry]:
        return list(self.entries.values())

    def get_all_audit_logs(self) -> List[AuditLog]:
        return self.audit_logs

    def find_previous_value(
        self,
        uniform_zone_id: str,
        field_name: str,
        before_timestamp: str,
    ) -> Optional[Any]:
        history = sorted(
            self.get_uniform_zone_history(uniform_zone_id),
            key=lambda e: e.timestamp,
            reverse=True,
        )

        for entry in history:
            if entry.timestamp < before_timestamp:
                if entry.before_value and field_name in entry.before_value:
                    return entry.before_value[field_name]
                if entry.after_value and field_name in entry.after_value:
                    return entry.after_value[field_name]

        return None

    def rollback_to(self, entry_id: str, operator: str) -> Optional[HistoryEntry]:
        entry = self.get_entry(entry_id)
        if not entry:
            return None

        return self.create_entry(
            uniform_zone_id=entry.uniform_zone_id,
            change_type=ChangeType.ROLLBACK,
            before_value=entry.after_value,
            after_value=entry.before_value,
            operator=operator,
            reason=f"回滚到变更前状态，回滚对象: {entry_id}",
            evidence_ref=entry_id,
        )

    def export_history(self, uniform_zone_id: str, output_path: str):
        history = sorted(
            self.get_uniform_zone_history(uniform_zone_id),
            key=lambda e: e.timestamp,
        )

        data = {
            "uniform_zone_id": uniform_zone_id,
            "export_time": datetime.now().isoformat(),
            "total_entries": len(history),
            "entries": [
                {
                    "entry_id": e.entry_id,
                    "timestamp": e.timestamp,
                    "change_type": e.change_type.value,
                    "operator": e.operator,
                    "reason": e.reason,
                    "evidence_ref": e.evidence_ref,
                    "command_used": e.command_used,
                    "before": e.before_value,
                    "after": e.after_value,
                }
                for e in history
            ],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return output_path
