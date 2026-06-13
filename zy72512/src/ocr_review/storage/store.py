import json
import os
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from ..models import (
    Ticket, TicketStatus, ChangeLog,
    MaskRule, RuleStatus,
    OCRRecord,
    ExportRecord, ExportStatus
)
from ..utils.mask import mask_text, has_sensitive_data


class DataStore:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.tickets_dir = self.base_dir / "tickets"
        self.rules_dir = self.base_dir / "rules"
        self.ocr_dir = self.base_dir / "ocr"
        self.exports_dir = self.base_dir / "exports"
        for d in [self.tickets_dir, self.rules_dir, self.ocr_dir, self.exports_dir]:
            d.mkdir(exist_ok=True)

    def _serialize(self, obj: Any) -> Dict:
        data = asdict(obj)
        result = {}
        for key, value in data.items():
            if key == "compiled_pattern":
                continue
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, Enum):
                result[key] = value.value
            else:
                result[key] = value
        return result

    def _sanitize_ticket_fields(self, data: Dict) -> Dict:
        if "fields" in data:
            for f in data["fields"]:
                if isinstance(f, dict):
                    field_value = f.get("field_value", "")
                    if field_value:
                        has, _ = has_sensitive_data(field_value)
                        if has:
                            if f.get("is_masked") and f.get("mask_pattern"):
                                masked_val = f["mask_pattern"]
                            else:
                                masked_val = mask_text(field_value)
                                f["mask_pattern"] = masked_val
                                f["is_masked"] = True
                            f["field_value"] = masked_val
                    if f.get("leak_note"):
                        f["leak_note"] = mask_text(f["leak_note"])
        for key in ["rule_notes", "algorithm_notes"]:
            if key in data and isinstance(data[key], list):
                for note_entry in data[key]:
                    if isinstance(note_entry, dict) and note_entry.get("note"):
                        note_entry["note"] = mask_text(note_entry["note"])
        if "change_logs" in data and isinstance(data["change_logs"], list):
            for log in data["change_logs"]:
                if isinstance(log, dict):
                    for k in ["old_value_summary", "new_value_summary", "note"]:
                        if log.get(k):
                            log[k] = mask_text(log[k])
        if "description" in data and isinstance(data["description"], str):
            data["description"] = mask_text(data["description"])
        return data

    def _sanitize_export_fields(self, data: Dict) -> Dict:
        if "fields" in data:
            for f in data["fields"]:
                if isinstance(f, dict):
                    orig = f.get("original_value", "")
                    if orig:
                        has, _ = has_sensitive_data(orig)
                        if has:
                            f["original_value"] = mask_text(orig)
                    if f.get("masked_value"):
                        f["masked_value"] = mask_text(f["masked_value"])
                    if f.get("explanation"):
                        f["explanation"] = mask_text(f["explanation"])
        if "audit_notes" in data:
            for i, note in enumerate(data["audit_notes"]):
                if isinstance(note, dict) and note.get("note"):
                    data["audit_notes"][i]["note"] = mask_text(note["note"])
        return data

    def save_ticket(self, ticket: Ticket) -> str:
        path = self.tickets_dir / f"{ticket.ticket_id}.json"
        data = self._serialize(ticket)
        data = self._sanitize_ticket_fields(data)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(path)

    def load_ticket(self, ticket_id: str) -> Optional[Ticket]:
        path = self.tickets_dir / f"{ticket_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._dict_to_ticket(data)

    def _dict_to_ticket(self, data: Dict) -> Ticket:
        from ..models.ticket import TicketField
        fields_data = data.pop("fields", [])
        fields = []
        for f in fields_data:
            fields.append(TicketField(**f))
        change_logs_data = data.pop("change_logs", [])
        change_logs = []
        for cl in change_logs_data:
            change_logs.append(ChangeLog(**cl))
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        data["status"] = TicketStatus(data["status"])
        return Ticket(fields=fields, change_logs=change_logs, **data)

    def list_tickets(self, status: Optional[TicketStatus] = None) -> List[Ticket]:
        tickets = []
        for path in self.tickets_dir.glob("*.json"):
            ticket = self.load_ticket(path.stem)
            if ticket and (status is None or ticket.status == status):
                tickets.append(ticket)
        return sorted(tickets, key=lambda t: t.created_at, reverse=True)

    def save_rule(self, rule: MaskRule) -> str:
        path = self.rules_dir / f"{rule.rule_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._serialize(rule), f, ensure_ascii=False, indent=2)
        return str(path)

    def load_rule(self, rule_id: str) -> Optional[MaskRule]:
        path = self.rules_dir / f"{rule_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        from ..models.rule import RuleType
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        data["status"] = RuleStatus(data["status"])
        data["rule_type"] = RuleType(data["rule_type"])
        data.pop("compiled_pattern", None)
        return MaskRule(**data)

    def list_rules(self, status: Optional[RuleStatus] = None) -> List[MaskRule]:
        rules = []
        for path in self.rules_dir.glob("*.json"):
            rule = self.load_rule(path.stem)
            if rule and (status is None or rule.status == status):
                rules.append(rule)
        return sorted(rules, key=lambda r: r.priority, reverse=True)

    def save_ocr_record(self, record: OCRRecord) -> str:
        path = self.ocr_dir / f"{record.record_id}.json"
        data = self._serialize(record)
        if "fields" in data:
            for f in data["fields"]:
                if isinstance(f, dict):
                    for k in ["original_text", "recognized_text", "corrected_text"]:
                        if f.get(k):
                            has, _ = has_sensitive_data(f[k])
                            if has:
                                f[k] = mask_text(f[k])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(path)

    def load_ocr_record(self, record_id: str) -> Optional[OCRRecord]:
        path = self.ocr_dir / f"{record.record_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        from ..models.ocr import OCRFieldResult
        fields = [OCRFieldResult(**f) for f in data.pop("fields")]
        data["processed_at"] = datetime.fromisoformat(data["processed_at"])
        return OCRRecord(fields=fields, **data)

    def save_export(self, export: ExportRecord) -> str:
        path = self.exports_dir / f"{export.export_id}.json"
        data = self._serialize(export)
        data = self._sanitize_export_fields(data)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(path)

    def load_export(self, export_id: str) -> Optional[ExportRecord]:
        path = self.exports_dir / f"{export_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        from ..models.export import ExportField
        fields = [ExportField(**f) for f in data.pop("fields")]
        data["generated_at"] = datetime.fromisoformat(data["generated_at"])
        data["status"] = ExportStatus(data["status"])
        return ExportRecord(fields=fields, **data)

    def list_exports(self, ticket_id: Optional[str] = None) -> List[ExportRecord]:
        exports = []
        for path in self.exports_dir.glob("*.json"):
            export = self.load_export(path.stem)
            if export and (ticket_id is None or export.ticket_id == ticket_id):
                exports.append(export)
        return sorted(exports, key=lambda e: e.generated_at, reverse=True)
