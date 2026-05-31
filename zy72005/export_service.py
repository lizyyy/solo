import os
import json
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
import pandas as pd
from models import Batch, PolicyRecord, AuditLog, SourceAttachment
from services import get_batch_summary


EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


def export_batch_to_excel(db: Session, batch_id: int, operator: str) -> str:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    records = db.query(PolicyRecord).filter(
        PolicyRecord.batch_id == batch_id
    ).order_by(PolicyRecord.id).all()

    summary = get_batch_summary(db, batch_id)

    data_rows = []
    for r in records:
        source_info = ""
        if r.source_attachment_id:
            att = db.query(SourceAttachment).filter(
                SourceAttachment.id == r.source_attachment_id
            ).first()
            if att:
                source_info = f"{att.source_type}:{att.reference_no} ({att.title})"

        status_display = r.status
        if r.is_suspended:
            status_display = "【挂起】" + status_display

        data_rows.append({
            "序号": r.id,
            "保单号": r.policy_no,
            "投保人": r.policy_holder or "",
            "经办人(外号)": r.agent_nickname or "",
            "经办人(实名)": r.agent_real_name or "",
            "原始生效日期": r.raw_effective_date or "",
            "解析后生效日期": r.effective_date.strftime("%Y-%m-%d") if r.effective_date else "",
            "原始现金价值": r.raw_cash_value or "",
            "解析后现金价值": r.cash_value if r.cash_value else "",
            "币种": r.currency or "",
            "退保日期": r.surrender_date.strftime("%Y-%m-%d") if r.surrender_date else "",
            "退保金额": r.surrender_amount if r.surrender_amount else "",
            "来源类型": r.source_type,
            "来源参考": r.source_reference or "",
            "来源凭证": source_info,
            "状态": status_display,
            "挂起原因": r.suspension_reason or "",
            "确认人": r.confirmed_by or "",
            "确认时间": r.confirmed_at.strftime("%Y-%m-%d %H:%M:%S") if r.confirmed_at else "",
            "审核备注": r.confirmation_notes or "",
        })

    df_records = pd.DataFrame(data_rows)

    summary_rows = [
        {"项目": "批次号", "数值": batch.batch_no},
        {"项目": "批次名称", "数值": batch.name},
        {"项目": "数据来源", "数值": batch.source},
        {"项目": "创建人", "数值": batch.created_by},
        {"项目": "创建时间", "数值": batch.created_at.strftime("%Y-%m-%d %H:%M:%S")},
        {"项目": "导出时间", "数值": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
        {"项目": "导出人", "数值": operator},
        {"项目": "总记录数", "数值": summary["total_records"]},
        {"项目": "已确认数", "数值": summary["confirmed_count"]},
        {"项目": "待确认数", "数值": summary["pending_count"]},
        {"项目": "挂起数", "数值": summary["suspended_count"]},
        {"项目": "已确认总金额(CNY)", "数值": round(summary["confirmed_total_amount"], 2)},
        {"项目": "挂起总金额(CNY)", "数值": round(summary["suspended_total_amount"], 2)},
        {"项目": "净确认金额(CNY)", "数值": round(summary["net_confirmed_amount"], 2)},
    ]
    df_summary = pd.DataFrame(summary_rows)

    suspended_records = [r for r in records if r.is_suspended]
    if suspended_records:
        exception_rows = []
        for r in suspended_records:
            exception_rows.append({
                "保单号": r.policy_no,
                "投保人": r.policy_holder or "",
                "挂起原因": r.suspension_reason or "",
                "原始现金价值": r.raw_cash_value or "",
                "建议处理": "请补充凭证后人工确认",
            })
        df_exceptions = pd.DataFrame(exception_rows)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"现金价值试算报告_{batch.batch_no}_{timestamp}.xlsx"
    filepath = os.path.join(EXPORT_DIR, filename)

    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        df_summary.to_excel(writer, sheet_name="汇总", index=False)
        df_records.to_excel(writer, sheet_name="明细数据", index=False)
        if suspended_records:
            df_exceptions.to_excel(writer, sheet_name="例外清单", index=False)

        worksheet = writer.sheets["明细数据"]
        for idx, col in enumerate(df_records.columns):
            max_len = max(
                df_records[col].astype(str).map(len).max(),
                len(str(col))
            ) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)

    audit_logs = db.query(AuditLog).filter(
        AuditLog.batch_id == batch_id
    ).order_by(AuditLog.created_at).all()

    json_report = {
        "export_metadata": {
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "exported_by": operator,
            "batch_no": batch.batch_no,
            "batch_name": batch.name,
        },
        "summary": summary,
        "records": [
            {
                "policy_no": r.policy_no,
                "policy_holder": r.policy_holder,
                "cash_value": r.cash_value,
                "currency": r.currency,
                "status": r.status,
                "is_suspended": r.is_suspended,
                "suspension_reason": r.suspension_reason,
                "source_reference": r.source_reference,
                "source_attachment_id": r.source_attachment_id,
                "confirmed_by": r.confirmed_by,
                "confirmed_at": r.confirmed_at.strftime("%Y-%m-%d %H:%M:%S") if r.confirmed_at else None,
            }
            for r in records
        ],
        "audit_trail": [
            {
                "time": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "action": log.action,
                "operator": log.operator,
                "record_id": log.record_id,
                "notes": log.notes,
                "decision_reasoning": log.decision_reasoning,
            }
            for log in audit_logs
        ],
        "data_integrity_check": {
            "record_count_match": len(records) == summary["total_records"],
            "source_linked_count": sum(1 for r in records if r.source_attachment_id or r.source_reference),
            "suspended_not_in_confirmed": all(r.status != "confirmed" for r in records if r.is_suspended),
        },
    }

    json_filename = f"现金价值试算报告_{batch.batch_no}_{timestamp}.json"
    json_filepath = os.path.join(EXPORT_DIR, json_filename)
    with open(json_filepath, "w", encoding="utf-8") as f:
        json.dump(json_report, f, ensure_ascii=False, indent=2)

    return filepath, json_filepath


def compare_records(db: Session, record_id: int) -> Dict:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == record_id).first()
    if not record:
        raise ValueError(f"Record {record_id} not found")

    logs = db.query(AuditLog).filter(
        AuditLog.record_id == record_id
    ).order_by(AuditLog.created_at).all()

    changes = []
    for log in logs:
        if log.old_value and log.new_value and log.old_value != log.new_value:
            try:
                old = json.loads(log.old_value) if log.old_value.startswith("{") else log.old_value
                new = json.loads(log.new_value) if log.new_value.startswith("{") else log.new_value
            except Exception:
                old = log.old_value
                new = log.new_value

            changes.append({
                "time": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "operator": log.operator,
                "action": log.action,
                "old_value": old,
                "new_value": new,
                "notes": log.notes,
                "reasoning": log.decision_reasoning,
            })

    if record.raw_data:
        raw = json.loads(record.raw_data)
    else:
        raw = {}

    return {
        "policy_no": record.policy_no,
        "original_raw_data": raw,
        "parsed_data": {
            "cash_value": record.cash_value,
            "currency": record.currency,
            "effective_date": record.effective_date.strftime("%Y-%m-%d") if record.effective_date else None,
            "agent_real_name": record.agent_real_name,
        },
        "current_status": record.status,
        "is_suspended": record.is_suspended,
        "change_history": changes,
        "confirmation_notes": record.confirmation_notes,
        "differences": _calculate_differences(changes),
    }


def _calculate_differences(changes: List[Dict]) -> List[str]:
    diffs = []
    for change in changes:
        if isinstance(change["old_value"], dict) and isinstance(change["new_value"], dict):
            for key in change["new_value"]:
                old = change["old_value"].get(key)
                new = change["new_value"].get(key)
                if old != new:
                    diffs.append(f"[{change['time']}] {change['operator']} 将 {key} 从 {old} 改为 {new}")
        elif change["old_value"] != change["new_value"]:
            diffs.append(f"[{change['time']}] {change['operator']} {change['action']}: {change['old_value']} -> {change['new_value']}")
    return diffs
