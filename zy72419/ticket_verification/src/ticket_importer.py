import csv
import json
import hashlib
from pathlib import Path
from typing import List, Tuple, Dict, Any
from datetime import datetime

from .models import TicketRecord, ImportBatch, LeaveStatus, normalize_status


class TicketImporter:
    def __init__(self):
        self.import_history: List[ImportBatch] = []
        self._batch_signatures: Dict[str, str] = {}

    def _compute_file_signature(self, file_path: str) -> str:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        content = path.read_bytes()
        return hashlib.md5(content).hexdigest()

    def _compute_record_signature(self, record: Dict[str, Any]) -> str:
        sorted_items = sorted(record.items())
        record_str = json.dumps(sorted_items, ensure_ascii=False, sort_keys=True)
        return hashlib.md5(record_str.encode('utf-8')).hexdigest()

    def detect_duplicate_batch(self, file_path: str) -> Tuple[bool, str]:
        sig = self._compute_file_signature(file_path)
        for batch in self.import_history:
            if batch.batch_id in self._batch_signatures and self._batch_signatures[batch.batch_id] == sig:
                return True, batch.batch_id
        return False, ""

    def import_from_csv(self, file_path: str, batch_id: str = None) -> Tuple[List[TicketRecord], ImportBatch]:
        file_path = str(file_path)
        is_duplicate, duplicate_of = self.detect_duplicate_batch(file_path)

        if not batch_id:
            batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        batch = ImportBatch(
            batch_id=batch_id,
            file_name=Path(file_path).name,
            is_duplicate=is_duplicate,
            duplicate_of=duplicate_of if is_duplicate else None
        )

        tickets: List[TicketRecord] = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticket = self._parse_row(row, batch_id)
                tickets.append(ticket)

        batch.record_count = len(tickets)
        self.import_history.append(batch)
        self._batch_signatures[batch_id] = self._compute_file_signature(file_path)

        return tickets, batch

    def import_from_json(self, file_path: str, batch_id: str = None) -> Tuple[List[TicketRecord], ImportBatch]:
        file_path = str(file_path)
        is_duplicate, duplicate_of = self.detect_duplicate_batch(file_path)

        if not batch_id:
            batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        batch = ImportBatch(
            batch_id=batch_id,
            file_name=Path(file_path).name,
            is_duplicate=is_duplicate,
            duplicate_of=duplicate_of if is_duplicate else None
        )

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        tickets: List[TicketRecord] = []
        records = data if isinstance(data, list) else data.get('records', [])

        for row in records:
            ticket = self._parse_row(row, batch_id)
            tickets.append(ticket)

        batch.record_count = len(tickets)
        self.import_history.append(batch)
        self._batch_signatures[batch_id] = self._compute_file_signature(file_path)

        return tickets, batch

    def _parse_row(self, row: Dict[str, Any], batch_id: str) -> TicketRecord:
        ticket_id = str(row.get('ticket_id', row.get('票号', row.get('id', '')))).strip()
        student_name = str(row.get('student_name', row.get('学员姓名', row.get('姓名', '')))).strip()
        repertoire = str(row.get('repertoire', row.get('曲目', row.get('演奏曲目', '')))).strip()
        performance_date = str(row.get('performance_date', row.get('演出日期', row.get('日期', '')))).strip()
        status = str(row.get('status', row.get('状态', row.get('核销状态', '待核销')))).strip()
        is_consumed = str(row.get('is_consumed', row.get('是否消耗', row.get('已消耗', 'false')))).lower() in ('true', '1', '是', '已消耗')

        leave_str = str(row.get('leave_status', row.get('请假状态', row.get('是否请假', '')))).strip()
        if leave_str in ('请假', 'true', '1', '是'):
            leave_status = LeaveStatus.LEAVE
        elif leave_str in ('补录', 'makeup'):
            leave_status = LeaveStatus.MAKEUP
        else:
            leave_status = LeaveStatus.NORMAL

        ticket = TicketRecord(
            ticket_id=ticket_id,
            student_name=student_name,
            repertoire=repertoire,
            performance_date=performance_date,
            status=status,
            is_consumed=is_consumed,
            leave_status=leave_status,
            import_batch=batch_id,
            raw_data=row.copy()
        )

        return ticket

    def find_duplicate_records(self, tickets: List[TicketRecord]) -> List[Tuple[TicketRecord, TicketRecord]]:
        duplicates = []
        seen: Dict[str, TicketRecord] = {}

        for ticket in tickets:
            norm_status = normalize_status(ticket.status)
            sig_fields = {
                'ticket_id': ticket.ticket_id,
                'student_name': ticket.student_name,
                'repertoire': ticket.repertoire,
                'performance_date': ticket.performance_date,
                'normalized_status': norm_status
            }
            sig = self._compute_record_signature(sig_fields)
            if sig in seen:
                duplicates.append((seen[sig], ticket))
            else:
                seen[sig] = ticket

        return duplicates
