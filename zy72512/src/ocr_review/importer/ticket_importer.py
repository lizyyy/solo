import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from ..models.ticket import Ticket, TicketField, TicketStatus
from ..storage.store import DataStore


@dataclass
class ImportResult:
    success: bool
    imported_count: int = 0
    failed_count: int = 0
    errors: List[str] = None
    ticket_ids: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.ticket_ids is None:
            self.ticket_ids = []


class TicketImporter:
    def __init__(self, store: DataStore):
        self.store = store

    def import_from_json(self, file_path: str) -> ImportResult:
        path = Path(file_path)
        if not path.exists():
            return ImportResult(success=False, errors=[f"文件不存在: {file_path}"])

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            return ImportResult(success=False, errors=[f"JSON解析失败: {str(e)}"])
        except Exception as e:
            return ImportResult(success=False, errors=[f"读取文件失败: {str(e)}"])

        if isinstance(data, dict):
            tickets_data = [data]
        elif isinstance(data, list):
            tickets_data = data
        else:
            return ImportResult(success=False, errors=["JSON格式错误，需要对象或数组"])

        return self._import_tickets(tickets_data)

    def import_from_dict(self, tickets_data: List[Dict[str, Any]]) -> ImportResult:
        return self._import_tickets(tickets_data)

    def _import_tickets(self, tickets_data: List[Dict[str, Any]]) -> ImportResult:
        result = ImportResult(success=True)

        for ticket_data in tickets_data:
            try:
                ticket = self._parse_ticket(ticket_data)
                self.store.save_ticket(ticket)
                result.imported_count += 1
                result.ticket_ids.append(ticket.ticket_id)
            except Exception as e:
                result.failed_count += 1
                result.errors.append(f"工单 {ticket_data.get('ticket_id', 'unknown')} 导入失败: {str(e)}")
                result.success = False

        return result

    def _parse_ticket(self, data: Dict[str, Any]) -> Ticket:
        fields_data = data.get("fields", [])
        fields = []
        for fd in fields_data:
            field = TicketField(
                field_name=fd.get("field_name", ""),
                field_value=fd.get("field_value", ""),
                is_masked=fd.get("is_masked", False),
                mask_pattern=fd.get("mask_pattern"),
                ocr_confidence=fd.get("ocr_confidence"),
                leak_detected=fd.get("leak_detected", False),
                leak_note=fd.get("leak_note"),
            )
            fields.append(field)

        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        elif created_at is None:
            created_at = datetime.now()

        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        elif updated_at is None:
            updated_at = datetime.now()

        status = data.get("status", TicketStatus.IMPORTED.value)
        if isinstance(status, str):
            status = TicketStatus(status)

        return Ticket(
            ticket_id=data.get("ticket_id", ""),
            source=data.get("source", "unknown"),
            created_at=created_at,
            title=data.get("title", ""),
            description=data.get("description", ""),
            fields=fields,
            status=status,
            assignee=data.get("assignee"),
            rule_notes=data.get("rule_notes", []),
            algorithm_notes=data.get("algorithm_notes", []),
            export_history=data.get("export_history", []),
            ocr_confidence_score=data.get("ocr_confidence_score"),
            updated_at=updated_at,
            metadata=data.get("metadata", {}),
        )
