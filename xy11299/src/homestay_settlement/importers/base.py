from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from pathlib import Path

from ..models import ImportError, ImportSourceType, AuditLog


@dataclass
class ImportResult:
    success_count: int = 0
    error_count: int = 0
    success_ids: List[int] = None
    errors: List[ImportError] = None

    def __post_init__(self):
        if self.success_ids is None:
            self.success_ids = []
        if self.errors is None:
            self.errors = []


class BaseImporter:
    def __init__(self, db: Session, source_type: ImportSourceType, operator: str = "system"):
        self.db = db
        self.source_type = source_type
        self.operator = operator
        self.result = ImportResult()

    def _save_error(
        self,
        source_file: str,
        source_row: Optional[int],
        raw_data: Dict[str, Any],
        error_message: str,
        suggested_fix: Optional[str] = None,
    ) -> ImportError:
        error = ImportError(
            source_type=self.source_type.value,
            source_file=source_file,
            source_row=source_row,
            raw_data=raw_data,
            error_message=error_message,
            suggested_fix=suggested_fix,
        )
        self.db.add(error)
        self.result.errors.append(error)
        self.result.error_count += 1
        return error

    def _log_audit(self, action: str, entity_type: str, entity_id: int, old_value: Dict = None, new_value: Dict = None):
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            operator=self.operator,
        )
        self.db.add(log)

    def _parse_date(self, date_str: str, formats: List[str] = None) -> Optional[datetime]:
        if not date_str or not str(date_str).strip():
            return None
        if formats is None:
            formats = [
                "%Y-%m-%d",
                "%Y/%m/%d",
                "%Y-%m-%d %H:%M:%S",
                "%Y/%m/%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%d/%m/%Y",
                "%m/%d/%Y",
            ]
        date_str = str(date_str).strip()
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None

    def _validate_required(self, data: Dict[str, Any], required_fields: List[str]) -> List[str]:
        missing = []
        for field in required_fields:
            value = data.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing.append(field)
        return missing

    def import_file(self, file_path: str) -> ImportResult:
        raise NotImplementedError

    def _process_single_record(self, record: Dict[str, Any], row_num: int, file_name: str) -> bool:
        raise NotImplementedError
