import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import dictdiffer
from rich.console import Console
from rich.table import Table

from .database import (
    AuditHistory,
    DataRecord,
    DataSourceType,
    ImportBatch,
    ImportMode,
    TaskStatus,
    ValidationError,
    ValidationLevel,
    get_session,
)

console = Console()


def generate_batch_no(source_type: DataSourceType) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    short_uuid = uuid.uuid4().hex[:6]
    return f"{source_type.value.upper()}-{timestamp}-{short_uuid}"


def generate_task_id() -> str:
    return f"TASK-{uuid.uuid4().hex[:12]}"


def get_source_key(source_type: DataSourceType, data: Dict[str, Any]) -> str:
    key_fields = {
        DataSourceType.PILE_ALARM: ["pile_id", "alarm_time", "alarm_code"],
        DataSourceType.INSPECTION: ["pile_id", "inspection_date"],
        DataSourceType.COMPLAINT: ["complaint_no"],
        DataSourceType.SUPPLIER_BILL: ["bill_no"],
        DataSourceType.OFFLINE_WORK_ORDER: ["order_no"],
        DataSourceType.APPROVAL_EMAIL: ["email_id"],
    }
    fields = key_fields.get(source_type, ["id"])
    key_parts = [str(data.get(f, "")) for f in fields]
    return "|".join(key_parts)


def calculate_diff(old_data: Dict, new_data: Dict) -> Dict:
    changes = []
    for diff in dictdiffer.diff(old_data, new_data):
        changes.append(list(diff))
    return {"changes": changes}


def record_audit(
    session,
    record_id: Optional[int],
    batch_id: Optional[int],
    action: str,
    old_value: Optional[str],
    new_value: Optional[str],
    changed_by: str,
    source_row_no: Optional[int] = None,
    field_name: Optional[str] = None,
    diff_data: Optional[Dict] = None,
) -> AuditHistory:
    audit = AuditHistory(
        record_id=record_id,
        batch_id=batch_id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by,
        source_row_no=source_row_no,
        diff_data=diff_data,
    )
    session.add(audit)
    return audit


def find_existing_record(session, source_type: DataSourceType, source_key: str):
    return (
        session.query(DataRecord)
        .filter_by(source_type=source_type, source_key=source_key)
        .order_by(DataRecord.created_at.desc())
        .first()
    )


def display_table(title: str, columns: List[str], rows: List[List[Any]]):
    table = Table(title=title)
    for col in columns:
        table.add_column(col)
    for row in rows:
        table.add_row(*[str(cell) for cell in row])
    console.print(table)


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None
