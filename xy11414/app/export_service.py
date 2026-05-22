from typing import List, Optional, Dict, Any
from datetime import datetime
from io import BytesIO
import pandas as pd
from sqlalchemy.orm import Session

from app.models import LedgerRecord, User, UserRole, RecordStatus
from app.permissions import is_field_visible, is_field_export_masked, get_mask_pattern, mask_value


def get_export_fields(db: Session, role: UserRole, masked: bool = True) -> List[str]:
    from app.permissions import DEFAULT_FIELD_CONFIG
    fields = []
    for field in DEFAULT_FIELD_CONFIG.keys():
        if not is_field_visible(db, field, role):
            continue
        if masked and is_field_export_masked(db, field):
            continue
        fields.append(field)
    return fields


def prepare_export_data(
    record: LedgerRecord,
    fields: List[str],
    db: Session,
    masked: bool = True
) -> Dict[str, Any]:
    data = {}
    for field in fields:
        value = getattr(record, field, None)
        if masked and is_field_export_masked(db, field):
            pattern = get_mask_pattern(db, field)
            data[field] = mask_value(value, pattern)
        else:
            if isinstance(value, datetime):
                data[field] = value.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(value, RecordStatus):
                data[field] = value.value
            else:
                data[field] = value
    return data


def export_to_excel(
    db: Session,
    user: User,
    record_ids: Optional[List[int]] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    franchise_id: Optional[str] = None,
    masked: bool = True
) -> BytesIO:
    query = db.query(LedgerRecord)

    if user.role != UserRole.SUPERVISOR and user.franchise_id:
        query = query.filter(LedgerRecord.franchise_id == user.franchise_id)

    if record_ids:
        query = query.filter(LedgerRecord.id.in_(record_ids))
    if start_date:
        query = query.filter(LedgerRecord.record_date >= start_date)
    if end_date:
        query = query.filter(LedgerRecord.record_date <= end_date)
    if franchise_id:
        query = query.filter(LedgerRecord.franchise_id == franchise_id)

    records = query.order_by(LedgerRecord.created_at.desc()).all()

    fields = get_export_fields(db, user.role, masked)

    export_data = []
    for record in records:
        export_data.append(prepare_export_data(record, fields, db, masked))

    df = pd.DataFrame(export_data, columns=fields)

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="台账记录")

        worksheet = writer.sheets["台账记录"]
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width

    output.seek(0)
    return output


def export_history_to_excel(
    db: Session,
    record_id: int,
    user: User,
    masked: bool = True
) -> BytesIO:
    record = db.query(LedgerRecord).filter(LedgerRecord.id == record_id).first()
    if not record:
        return BytesIO()

    status_data = []
    for sh in record.status_history:
        status_data.append({
            "变更时间": sh.changed_at.strftime("%Y-%m-%d %H:%M:%S") if sh.changed_at else "",
            "变更前状态": sh.from_status.value if sh.from_status else "",
            "变更后状态": sh.to_status.value if sh.to_status else "",
            "操作人ID": sh.changed_by if sh.changed_by else "",
            "变更原因": sh.reason or ""
        })

    field_data = []
    for fc in record.field_changes:
        old_val = fc.old_value
        new_val = fc.new_value
        if masked and is_field_export_masked(db, fc.field_name):
            pattern = get_mask_pattern(db, fc.field_name)
            old_val = mask_value(old_val, pattern) if old_val else ""
            new_val = mask_value(new_val, pattern) if new_val else ""
        field_data.append({
            "变更时间": fc.changed_at.strftime("%Y-%m-%d %H:%M:%S") if fc.changed_at else "",
            "字段名": fc.field_name,
            "变更前值": old_val,
            "变更后值": new_val,
            "操作人ID": fc.changed_by if fc.changed_by else "",
            "变更原因": fc.change_reason or ""
        })

    dirty_data = []
    for dr in record.dirty_records:
        dirty_data.append({
            "脏记录类型": dr.dirty_type.value,
            "字段名": dr.field_name or "",
            "原始值": dr.original_value or "",
            "当前值": dr.current_value or "",
            "期望值": dr.expected_value or "",
            "描述": dr.description or "",
            "是否已解决": "是" if dr.is_resolved else "否",
            "解决时间": dr.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if dr.resolved_at else "",
            "解决说明": dr.resolution_notes or ""
        })

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        if status_data:
            pd.DataFrame(status_data).to_excel(writer, index=False, sheet_name="状态变更历史")
        if field_data:
            pd.DataFrame(field_data).to_excel(writer, index=False, sheet_name="字段变更历史")
        if dirty_data:
            pd.DataFrame(dirty_data).to_excel(writer, index=False, sheet_name="脏记录追踪")

        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width

    output.seek(0)
    return output
