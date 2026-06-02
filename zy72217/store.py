import json
import uuid
from datetime import datetime
from typing import Dict, Optional, List
from models import PositionGapWarning, AdjustmentEntry, AuditTrail


class DataStore:
    def __init__(self):
        self._warnings: Dict[str, PositionGapWarning] = {}
        self._import_history: List[Dict] = []

    def create_warning(self, report_date: str, fund_code: str, fund_name: str) -> PositionGapWarning:
        warning_id = str(uuid.uuid4())
        warning = PositionGapWarning(
            id=warning_id,
            report_date=report_date,
            fund_code=fund_code,
            fund_name=fund_name
        )
        self._warnings[warning_id] = warning
        return warning

    def get_warning(self, warning_id: str) -> Optional[PositionGapWarning]:
        return self._warnings.get(warning_id)

    def get_all_warnings(self) -> List[PositionGapWarning]:
        return list(self._warnings.values())

    def update_warning(self, warning: PositionGapWarning) -> None:
        warning.updated_at = datetime.now()
        self._warnings[warning.id] = warning

    def add_adjustment_entry(self, warning_id: str, entry: AdjustmentEntry) -> None:
        warning = self.get_warning(warning_id)
        if warning:
            warning.entries.append(entry)
            self.update_warning(warning)

    def add_audit_trail(self, entry: AdjustmentEntry, operator: str, action: str,
                        before_value: Optional[str] = None, after_value: Optional[str] = None,
                        remark: Optional[str] = None) -> None:
        audit = AuditTrail(
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            before_value=before_value,
            after_value=after_value,
            remark=remark
        )
        entry.audit_trails.append(audit)

    def record_import(self, file_name: str, row_count: int, warning_id: str) -> None:
        self._import_history.append({
            'timestamp': datetime.now().isoformat(),
            'file_name': file_name,
            'row_count': row_count,
            'warning_id': warning_id
        })

    def is_duplicate_import(self, file_name: str, warning_id: str) -> bool:
        for record in self._import_history:
            if record['file_name'] == file_name and record['warning_id'] == warning_id:
                return True
        return False


store = DataStore()
