import csv
import os
import uuid
from subsidy_reconciler.db import Database, compute_hash
from subsidy_reconciler.models import (
    SOURCE_PAYMENT,
    SOURCE_REFUND,
    SOURCE_APPROVAL_EMAIL,
    SOURCE_MANUAL_NOTE,
    SOURCE_TYPES,
    SOURCE_TYPE_LABELS,
    STATUS_CONFIRMED,
    STATUS_PENDING_MATERIAL,
    STATUS_PENDING_MANUAL,
    STATUS_OLD_STANDARD,
    CSV_COLUMNS,
)


def _auto_detect_source_type(file_name):
    base = os.path.basename(file_name).lower()
    if "payment" in base or "收款" in base or "流水" in base:
        return SOURCE_PAYMENT
    if "refund" in base or "退款" in base:
        return SOURCE_REFUND
    if "approval" in base or "审批" in base or "邮件" in base:
        return SOURCE_APPROVAL_EMAIL
    if "note" in base or "备注" in base or "手写" in base:
        return SOURCE_MANUAL_NOTE
    return None


def _infer_status(source_type, row_data):
    if source_type == SOURCE_PAYMENT:
        if row_data.get("refund_reason") or row_data.get("退款原因"):
            return STATUS_PENDING_MANUAL, "收款流水中含退款标记，需人工确认"
        return STATUS_CONFIRMED, "收款流水与补贴金额匹配，自动确认"

    if source_type == SOURCE_REFUND:
        return STATUS_PENDING_MANUAL, "退款申请需人工确认退款合理性"

    if source_type == SOURCE_APPROVAL_EMAIL:
        email_subject = row_data.get("email_subject") or row_data.get("邮件主题") or ""
        email_date = row_data.get("email_date") or row_data.get("邮件日期") or ""
        if "旧口径" in email_subject or "历史" in email_subject or "调整" in email_subject:
            return STATUS_OLD_STANDARD, f"审批邮件标记为旧口径: {email_subject}"
        return STATUS_CONFIRMED, f"审批邮件确认: {email_subject or '无主题'}"

    if source_type == SOURCE_MANUAL_NOTE:
        return STATUS_PENDING_MATERIAL, "手写备注需补充正式审批材料"

    return STATUS_PENDING_MATERIAL, "未知来源类型，需补充材料"


def _parse_row(source_type, row):
    result = {}
    if source_type == SOURCE_PAYMENT:
        result["subsidy_date"] = row.get("日期", "").strip()
        result["movie_name"] = row.get("影片名称", "").strip()
        result["ticket_count"] = int(row.get("票数", 0))
        result["subsidy_amount"] = float(row.get("补贴金额", 0))
        result["refund_reason"] = row.get("退款原因", "").strip()
    elif source_type == SOURCE_REFUND:
        result["subsidy_date"] = row.get("日期", "").strip()
        result["movie_name"] = row.get("影片名称", "").strip()
        result["ticket_count"] = int(row.get("票数", 0))
        result["subsidy_amount"] = float(row.get("退款金额", 0))
        result["refund_reason"] = row.get("退款原因", "").strip()
    elif source_type == SOURCE_APPROVAL_EMAIL:
        result["subsidy_date"] = row.get("日期", "").strip()
        result["movie_name"] = row.get("影片名称", "").strip()
        result["ticket_count"] = int(row.get("票数", 0))
        result["subsidy_amount"] = float(row.get("审批金额", 0))
        result["email_subject"] = row.get("邮件主题", "").strip()
        result["email_date"] = row.get("邮件日期", "").strip()
    elif source_type == SOURCE_MANUAL_NOTE:
        result["subsidy_date"] = row.get("日期", "").strip()
        result["movie_name"] = row.get("影片名称", "").strip()
        result["ticket_count"] = int(row.get("票数", 0))
        result["subsidy_amount"] = float(row.get("金额", 0))
        result["note"] = row.get("备注", "").strip()
    return result


def import_file(file_path, source_type=None, db=None):
    if db is None:
        db = Database()

    if source_type is None:
        source_type = _auto_detect_source_type(file_path)
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"无法识别来源类型，请通过 --type 指定。支持: {SOURCE_TYPES}")

    batch_id = uuid.uuid4().hex[:8]
    file_name = os.path.basename(file_path)

    counts = {"imported": 0, "skipped": 0, "updated": 0, "conflicted": 0}
    total_rows = 0

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for line_num, row in enumerate(reader, start=2):
            total_rows += 1
            parsed = _parse_row(source_type, row)
            if not parsed.get("subsidy_date") or not parsed.get("movie_name"):
                continue

            status, judgment_reason = _infer_status(source_type, parsed)

            record_hash = compute_hash(
                parsed["subsidy_date"], parsed["movie_name"],
                source_type, parsed["subsidy_amount"]
            )

            remark_parts = []
            if parsed.get("refund_reason"):
                remark_parts.append(f"退款原因: {parsed['refund_reason']}")
            if parsed.get("email_subject"):
                remark_parts.append(f"邮件主题: {parsed['email_subject']}")
            if parsed.get("email_date"):
                remark_parts.append(f"邮件日期: {parsed['email_date']}")
            if parsed.get("note"):
                remark_parts.append(f"备注: {parsed['note']}")

            result = db.insert_record(
                record_hash=record_hash,
                subsidy_date=parsed["subsidy_date"],
                movie_name=parsed["movie_name"],
                ticket_count=parsed["ticket_count"],
                subsidy_amount=parsed["subsidy_amount"],
                source_type=source_type,
                source_file=file_name,
                source_line=line_num,
                status=status,
                judgment_reason=judgment_reason,
                import_batch=batch_id,
            )

            if result in counts:
                counts[result] += 1

            if result == "imported" and remark_parts:
                db.supplement_record(record_hash,
                                     remark="\n".join(remark_parts))

    db.add_import_log(
        batch_id=batch_id, file_name=file_name, file_type=source_type,
        total_rows=total_rows, imported=counts["imported"],
        skipped=counts["skipped"], updated=counts["updated"],
        conflicted=counts["conflicted"]
    )

    return {
        "batch_id": batch_id,
        "file_name": file_name,
        "source_type": source_type,
        "source_type_label": SOURCE_TYPE_LABELS.get(source_type, source_type),
        "total_rows": total_rows,
        **counts,
    }


def import_directory(dir_path, index_file=None, db=None):
    if db is None:
        db = Database()

    results = []

    if index_file and os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                fpath = row.get("file", "").strip()
                stype = row.get("type", "").strip() or None
                full_path = os.path.join(dir_path, fpath)
                if os.path.exists(full_path):
                    result = import_file(full_path, source_type=stype, db=db)
                    results.append(result)
    else:
        for fname in sorted(os.listdir(dir_path)):
            if fname.endswith(".csv"):
                fpath = os.path.join(dir_path, fname)
                result = import_file(fpath, db=db)
                results.append(result)

    return results
