import json
from datetime import datetime
from typing import List, Tuple
import store
from models import GpsReleaseRecord, ImportLog, ImportMode, Status, Source


def _parse_record(item: dict, batch_id: str, source: str = Source.INITIAL.value) -> GpsReleaseRecord:
    now = datetime.now().isoformat()
    return GpsReleaseRecord(
        contract_no=item.get("contract_no", ""),
        customer_name=item.get("customer_name", ""),
        plate_no=item.get("plate_no"),
        vehicle_model=item.get("vehicle_model"),
        gps_fee=item.get("gps_fee"),
        payment_ref=item.get("payment_ref"),
        payment_date=item.get("payment_date"),
        payment_amount=item.get("payment_amount"),
        refund_applied=item.get("refund_applied"),
        refund_amount=item.get("refund_amount"),
        approval_email=item.get("approval_email"),
        remarks=item.get("remarks"),
        receipt_info=item.get("receipt_info"),
        status=Status.PENDING.value,
        source=source,
        is_old_format=item.get("is_old_format", 0),
        batch_id=batch_id,
        created_at=now,
        updated_at=now,
    )


def _auto_classify(rec: GpsReleaseRecord) -> str:
    reasons = rec.needs_review_reasons()
    if reasons:
        return Status.NEEDS_REVIEW.value
    return Status.PENDING.value


def import_records(
    file_path: str,
    batch_id: str,
    mode: str = ImportMode.SKIP.value,
    db_path: str = store.DB_PATH,
) -> ImportLog:
    conn = store.get_conn(db_path)
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data if isinstance(data, list) else data.get("records", [])

    inserted = 0
    skipped = 0
    updated = 0
    conflicted = 0
    details = []

    for item in records:
        rec = _parse_record(item, batch_id)
        if not rec.contract_no:
            details.append({"contract_no": "", "action": "skipped", "reason": "合同号为空"})
            skipped += 1
            continue

        if store.record_exists(conn, rec.contract_no):
            if mode == ImportMode.SKIP.value:
                details.append({"contract_no": rec.contract_no, "action": "skipped", "reason": "重复，跳过"})
                skipped += 1
            elif mode == ImportMode.UPDATE.value:
                store.update_record(conn, rec)
                details.append({"contract_no": rec.contract_no, "action": "updated", "reason": "重复，覆盖更新"})
                updated += 1
            elif mode == ImportMode.CONFLICT.value:
                if store.fields_differ(conn, rec):
                    store.update_status(conn, rec.contract_no, Status.NEEDS_REVIEW.value)
                    details.append({
                        "contract_no": rec.contract_no,
                        "action": "conflicted",
                        "reason": "字段冲突，标记为需人工确认",
                    })
                    conflicted += 1
                else:
                    details.append({"contract_no": rec.contract_no, "action": "skipped", "reason": "重复，字段无差异"})
                    skipped += 1
        else:
            rec.status = _auto_classify(rec)
            store.insert_record(conn, rec)
            detail = {"contract_no": rec.contract_no, "action": "inserted"}
            if rec.status == Status.NEEDS_REVIEW.value:
                detail["reason"] = "; ".join(rec.needs_review_reasons())
            details.append(detail)
            inserted += 1

    log = ImportLog(
        batch_id=batch_id,
        file_name=file_path,
        import_time=datetime.now().isoformat(),
        total_records=len(records),
        inserted=inserted,
        skipped=skipped,
        updated=updated,
        conflicted=conflicted,
        details=json.dumps(details, ensure_ascii=False),
    )
    store.insert_import_log(conn, log)
    conn.close()
    return log


def supplement_records(
    file_path: str,
    batch_id: str,
    db_path: str = store.DB_PATH,
) -> ImportLog:
    conn = store.get_conn(db_path)
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data if isinstance(data, list) else data.get("records", [])

    inserted = 0
    skipped = 0
    updated = 0
    conflicted = 0
    details = []

    for item in records:
        contract_no = item.get("contract_no", "")
        if not contract_no:
            details.append({"contract_no": "", "action": "skipped", "reason": "合同号为空"})
            skipped += 1
            continue

        if store.record_exists(conn, contract_no):
            fields = {k: v for k, v in item.items() if k != "contract_no"}
            store.supplement_record(conn, contract_no, fields)
            existing = store.get_record(conn, contract_no)
            if existing and existing.status == Status.NEEDS_REVIEW.value:
                new_reasons = existing.needs_review_reasons()
                if not new_reasons:
                    store.update_status(conn, contract_no, Status.PENDING.value)
                    details.append({
                        "contract_no": contract_no,
                        "action": "updated",
                        "reason": "补材料后问题已解决，状态回到待处理",
                    })
                else:
                    details.append({
                        "contract_no": contract_no,
                        "action": "updated",
                        "reason": f"补材料后仍有问题: {'; '.join(new_reasons)}",
                    })
            else:
                details.append({
                    "contract_no": contract_no,
                    "action": "updated",
                    "reason": "补材料，补充空字段",
                })
            updated += 1
        else:
            rec = _parse_record(item, batch_id, source=Source.SUPPLEMENTARY.value)
            rec.status = _auto_classify(rec)
            store.insert_record(conn, rec)
            details.append({
                "contract_no": contract_no,
                "action": "inserted",
                "reason": "新记录（补材料导入）",
            })
            inserted += 1

    log = ImportLog(
        batch_id=batch_id,
        file_name=file_path,
        import_time=datetime.now().isoformat(),
        total_records=len(records),
        inserted=inserted,
        skipped=skipped,
        updated=updated,
        conflicted=conflicted,
        details=json.dumps(details, ensure_ascii=False),
    )
    store.insert_import_log(conn, log)
    conn.close()
    return log
