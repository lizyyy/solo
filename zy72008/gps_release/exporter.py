import csv
import json
import os
from typing import List, Optional
from datetime import datetime
import store
from models import GpsReleaseRecord, Status, STATUS_LABELS, SOURCE_LABELS


REPORT_FIELDS = [
    ("contract_no", "合同编号"),
    ("customer_name", "客户姓名"),
    ("plate_no", "车牌号"),
    ("vehicle_model", "车型"),
    ("gps_fee", "GPS费用"),
    ("payment_ref", "收款流水号"),
    ("payment_date", "收款日期"),
    ("payment_amount", "收款金额"),
    ("refund_applied", "是否申请退款"),
    ("refund_amount", "退款金额"),
    ("approval_email", "审批邮件"),
    ("remarks", "备注"),
    ("receipt_info", "银企回单信息"),
    ("status", "状态码"),
    ("status_label", "状态"),
    ("source_label", "来源"),
    ("is_old_format", "旧口径"),
    ("confirmed_by", "确认人"),
    ("confirmed_at", "确认时间"),
    ("batch_id", "批次号"),
    ("created_at", "创建时间"),
    ("updated_at", "更新时间"),
]


def export_csv(
    output_path: str,
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    db_path: str = store.DB_PATH,
) -> str:
    conn = store.get_conn(db_path)
    records = store.list_records(conn, status=status, batch_id=batch_id)
    conn.close()

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([label for _, label in REPORT_FIELDS])
        for rec in records:
            d = rec.to_dict()
            row = []
            for field_name, _ in REPORT_FIELDS:
                val = d.get(field_name, "")
                if val is None:
                    val = ""
                row.append(val)
            writer.writerow(row)

    return output_path


def export_text(
    output_path: str,
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    db_path: str = store.DB_PATH,
) -> str:
    conn = store.get_conn(db_path)
    records = store.list_records(conn, status=status, batch_id=batch_id)
    conn.close()

    lines = []
    lines.append("=" * 80)
    lines.append(f"汽车金融GPS解押报告  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 80)

    for rec in records:
        d = rec.to_dict()
        lines.append("")
        lines.append(f"合同编号:   {d['contract_no']}")
        lines.append(f"客户姓名:   {d['customer_name']}")
        lines.append(f"车牌号:     {d.get('plate_no') or '-'}")
        lines.append(f"车型:       {d.get('vehicle_model') or '-'}")
        lines.append(f"GPS费用:    {d.get('gps_fee') or '-'}")
        lines.append(f"收款流水号: {d.get('payment_ref') or '-'}")
        lines.append(f"收款日期:   {d.get('payment_date') or '-'}")
        lines.append(f"收款金额:   {d.get('payment_amount') or '-'}")
        lines.append(f"退款申请:   {'是' if d.get('refund_applied') else '否'}")
        lines.append(f"退款金额:   {d.get('refund_amount') or '-'}")
        lines.append(f"审批邮件:   {d.get('approval_email') or '-'}")
        lines.append(f"备注:       {d.get('remarks') or '-'}")
        lines.append(f"回单信息:   {d.get('receipt_info') or '-'}")
        lines.append(f"状态:       {d['status_label']}")
        lines.append(f"来源:       {d['source_label']}")
        lines.append(f"旧口径:     {'是' if d.get('is_old_format') else '否'}")
        lines.append(f"确认人:     {d.get('confirmed_by') or '-'}")
        lines.append(f"确认时间:   {d.get('confirmed_at') or '-'}")
        lines.append(f"批次号:     {d['batch_id']}")
        if rec.status != Status.COMPLETED.value and rec.status != Status.REJECTED.value:
            reasons = rec.needs_review_reasons()
            if reasons:
                lines.append(f"待确认原因: {'; '.join(reasons)}")
        lines.append("-" * 40)

    lines.append("")
    lines.append(f"共 {len(records)} 条记录")
    lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return output_path


def diff_report(
    batch_id_1: str,
    batch_id_2: str,
    db_path: str = store.DB_PATH,
) -> str:
    conn = store.get_conn(db_path)
    log1 = store.get_import_log(conn, batch_id_1)
    log2 = store.get_import_log(conn, batch_id_2)
    all_records = store.list_records(conn)
    conn.close()

    lines = []
    lines.append("=" * 80)
    lines.append(f"批次差异报告  批次A: {batch_id_1}  批次B: {batch_id_2}")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 80)

    if not log1 and not log2:
        lines.append("\n未找到任一批次的导入记录")
        return "\n".join(lines)

    for label, log in [(f"批次A ({batch_id_1})", log1), (f"批次B ({batch_id_2})", log2)]:
        if log:
            details = json.loads(log.details)
            lines.append(f"\n{label}:")
            lines.append(f"  文件: {log.file_name}")
            lines.append(f"  导入时间: {log.import_time}")
            lines.append(f"  总记录: {log.total_records}  新增: {log.inserted}  跳过: {log.skipped}  更新: {log.updated}  冲突: {log.conflicted}")
            if details:
                lines.append(f"  逐条明细:")
                for d in details:
                    cn = d.get("contract_no", "(空)")
                    action = {"inserted": "新增", "skipped": "跳过", "updated": "更新", "conflicted": "冲突"}.get(d.get("action"), d.get("action"))
                    reason = d.get("reason", "")
                    line = f"    {cn}: {action}"
                    if reason:
                        line += f" - {reason}"
                    lines.append(line)
        else:
            lines.append(f"\n{label}: 未找到导入记录")

    if log1 and log2:
        d1 = json.loads(log1.details)
        d2 = json.loads(log2.details)
        contracts_1 = {d.get("contract_no") for d in d1 if d.get("contract_no")}
        contracts_2 = {d.get("contract_no") for d in d2 if d.get("contract_no")}
        only_in_1 = contracts_1 - contracts_2
        only_in_2 = contracts_2 - contracts_1
        common = contracts_1 & contracts_2

        lines.append(f"\n{'=' * 80}")
        lines.append(f"交叉对比:")
        if only_in_1:
            lines.append(f"\n  仅在批次A中出现 ({len(only_in_1)} 条):")
            for cn in sorted(only_in_1):
                rec = next((r for r in all_records if r.contract_no == cn), None)
                name = rec.customer_name if rec else "?"
                lines.append(f"    - {cn} ({name})")
        if only_in_2:
            lines.append(f"\n  仅在批次B中出现 ({len(only_in_2)} 条):")
            for cn in sorted(only_in_2):
                rec = next((r for r in all_records if r.contract_no == cn), None)
                name = rec.customer_name if rec else "?"
                lines.append(f"    - {cn} ({name})")
        if common:
            lines.append(f"\n  两批次共有合同号 ({len(common)} 条):")
            for cn in sorted(common):
                a1 = next((d.get("action") for d in d1 if d.get("contract_no") == cn), "?")
                a2 = next((d.get("action") for d in d2 if d.get("contract_no") == cn), "?")
                r1 = next((d.get("reason") for d in d1 if d.get("contract_no") == cn), "")
                r2 = next((d.get("reason") for d in d2 if d.get("contract_no") == cn), "")
                line = f"    {cn}: 批次A={a1}"
                if r1:
                    line += f"({r1})"
                line += f"  批次B={a2}"
                if r2:
                    line += f"({r2})"
                lines.append(line)

    return "\n".join(lines)
