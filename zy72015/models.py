from typing import List, Dict, Optional, Tuple
from storage import (
    load_records, save_records, load_batches, save_batches,
    generate_id, now_str
)
from copy import deepcopy


class RecordStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SUSPENDED = "suspended"
    DISCREPANCY = "discrepancy"

    STATUS_LABELS = {
        PENDING: "待确认",
        CONFIRMED: "已确认",
        SUSPENDED: "已挂起",
        DISCREPANCY: "有差异"
    }


class DataSource:
    BANK_RECEIPT = "bank_receipt"
    BUSINESS_LEDGER = "business_ledger"
    GROUP_SCREENSHOT = "group_screenshot"
    MONTHLY_STATEMENT = "monthly_statement"

    SOURCE_LABELS = {
        BANK_RECEIPT: "银行回单",
        BUSINESS_LEDGER: "业务台账",
        GROUP_SCREENSHOT: "群截图",
        MONTHLY_STATEMENT: "月底对账表"
    }


def create_revenue_record(
    batch_no: str,
    source: str,
    source_ref: str,
    pile_no: str,
    transaction_date: str,
    expected_amount: float,
    actual_amount: Optional[float] = None,
    original_remarks: str = "",
    operator: str = "系统",
    period: str = ""
) -> Dict:
    record = {
        "id": generate_id("REC"),
        "batch_no": batch_no,
        "period": period,
        "source": source,
        "source_ref": source_ref,
        "pile_no": pile_no,
        "transaction_date": transaction_date,
        "expected_amount": expected_amount,
        "actual_amount": actual_amount,
        "original_remarks": original_remarks,
        "processing_notes": "",
        "status": RecordStatus.PENDING,
        "operator": operator,
        "created_at": now_str(),
        "updated_at": now_str(),
        "processing_history": []
    }

    if actual_amount is not None:
        diff = abs(expected_amount - actual_amount)
        if diff > 0.01:
            record["status"] = RecordStatus.DISCREPANCY
            record["processing_notes"] = (
                f"【业务提醒】台账应收{expected_amount:.2f}元，银行实收{actual_amount:.2f}元，"
                f"差异{diff:.2f}元。请业务同事核对：1) 是否有手续费扣除 2) 是否有退款 3) 是否有优惠活动 "
                "4) 是否记账日期跨月。核对后请做人工确认。"
            )
        else:
            record["status"] = RecordStatus.CONFIRMED
            record["processing_notes"] = (
                "【自动确认】台账金额与银行到账金额一致，已自动归集。"
            )

    record["processing_history"].append({
        "action": "创建记录",
        "from_status": "",
        "to_status": record["status"],
        "operator": operator,
        "timestamp": now_str(),
        "reason": "从数据源导入",
        "notes": f"来源：{DataSource.SOURCE_LABELS.get(source, source)}，参考号：{source_ref}"
    })

    records = load_records()
    records.append(record)
    save_records(records)

    _update_batch_amounts(batch_no)

    return record


def create_batch(period: str, operator: str = "系统") -> Dict:
    batch = {
        "batch_no": generate_id("BAT"),
        "period": period,
        "status": "open",
        "total_expected": 0.0,
        "total_actual": 0.0,
        "confirmed_amount": 0.0,
        "suspended_amount": 0.0,
        "pending_count": 0,
        "confirmed_count": 0,
        "suspended_count": 0,
        "discrepancy_count": 0,
        "created_at": now_str(),
        "closed_at": None,
        "operator": operator
    }
    batches = load_batches()
    batches.append(batch)
    save_batches(batches)
    return batch


def _update_batch_amounts(batch_no: str) -> None:
    records = load_records()
    batches = load_batches()

    batch_records = [r for r in records if r["batch_no"] == batch_no]

    for batch in batches:
        if batch["batch_no"] == batch_no:
            batch["total_expected"] = sum(r["expected_amount"] for r in batch_records)
            batch["total_actual"] = sum(
                r["actual_amount"] for r in batch_records
                if r["actual_amount"] is not None
            )
            batch["confirmed_amount"] = sum(
                r["actual_amount"] for r in batch_records
                if r["status"] == RecordStatus.CONFIRMED and r["actual_amount"] is not None
            )
            batch["suspended_amount"] = sum(
                r["expected_amount"] for r in batch_records
                if r["status"] == RecordStatus.SUSPENDED
            )
            batch["pending_count"] = sum(
                1 for r in batch_records if r["status"] == RecordStatus.PENDING
            )
            batch["confirmed_count"] = sum(
                1 for r in batch_records if r["status"] == RecordStatus.CONFIRMED
            )
            batch["suspended_count"] = sum(
                1 for r in batch_records if r["status"] == RecordStatus.SUSPENDED
            )
            batch["discrepancy_count"] = sum(
                1 for r in batch_records if r["status"] == RecordStatus.DISCREPANCY
            )
            break

    save_batches(batches)


def update_record_status(
    record_id: str,
    new_status: str,
    operator: str,
    reason: str,
    processing_notes: str = ""
) -> Optional[Dict]:
    records = load_records()
    record = None
    for r in records:
        if r["id"] == record_id:
            record = r
            break

    if record is None:
        return None

    old_status = record["status"]
    record["status"] = new_status
    record["operator"] = operator
    record["updated_at"] = now_str()

    if processing_notes:
        if record["processing_notes"]:
            record["processing_notes"] += "\n" + processing_notes
        else:
            record["processing_notes"] = processing_notes

    record["processing_history"].append({
        "action": f"状态变更：{RecordStatus.STATUS_LABELS.get(old_status, old_status)} → {RecordStatus.STATUS_LABELS.get(new_status, new_status)}",
        "from_status": old_status,
        "to_status": new_status,
        "operator": operator,
        "timestamp": now_str(),
        "reason": reason,
        "notes": processing_notes
    })

    save_records(records)
    _update_batch_amounts(record["batch_no"])

    return record


def confirm_record(record_id: str, operator: str, reason: str, notes: str = "") -> Optional[Dict]:
    processing_notes = f"【人工确认】{reason}。{notes}".strip()
    return update_record_status(
        record_id, RecordStatus.CONFIRMED, operator, reason, processing_notes
    )


def suspend_record(record_id: str, operator: str, reason: str, notes: str = "") -> Optional[Dict]:
    processing_notes = (
        f"【挂起处理】{reason}。{notes}\n"
        "【业务提醒】此记录因缺少凭证已挂起，暂不参与收益归集。"
        "请补充：1) 银行回单 2) 业务台账截图 3) 相关说明文档。"
        "补齐后重新发起确认。"
    ).strip()
    return update_record_status(
        record_id, RecordStatus.SUSPENDED, operator, reason, processing_notes
    )


def flag_discrepancy(record_id: str, operator: str, reason: str, notes: str = "") -> Optional[Dict]:
    processing_notes = (
        f"【标记差异】{reason}。{notes}\n"
        "【业务提醒】请业务同事核对差异原因，常见原因包括："
        "1) 手续费扣除 2) 客户退款 3) 优惠活动 4) 记账跨月 5) 数据录入错误。"
    ).strip()
    return update_record_status(
        record_id, RecordStatus.DISCREPANCY, operator, reason, processing_notes
    )


def get_record(record_id: str) -> Optional[Dict]:
    records = load_records()
    for r in records:
        if r["id"] == record_id:
            return r
    return None


def get_records_by_batch(batch_no: str) -> List[Dict]:
    records = load_records()
    return [r for r in records if r["batch_no"] == batch_no]


def get_batch(batch_no: str) -> Optional[Dict]:
    batches = load_batches()
    for b in batches:
        if b["batch_no"] == batch_no:
            return b
    return None


def get_all_batches() -> List[Dict]:
    return load_batches()


def get_all_records() -> List[Dict]:
    return load_records()


def get_discrepancy_list(batch_no: Optional[str] = None) -> List[Dict]:
    records = load_records()
    if batch_no:
        records = [r for r in records if r["batch_no"] == batch_no]
    return [r for r in records if r["status"] in (RecordStatus.DISCREPANCY, RecordStatus.PENDING)]


def get_summary(batch_no: Optional[str] = None) -> Dict:
    records = load_records()
    if batch_no:
        records = [r for r in records if r["batch_no"] == batch_no]

    summary = {
        "total_count": len(records),
        "total_expected": sum(r["expected_amount"] for r in records),
        "total_actual": sum(r["actual_amount"] for r in records if r["actual_amount"] is not None),
        "confirmed_amount": sum(
            r["actual_amount"] for r in records
            if r["status"] == RecordStatus.CONFIRMED and r["actual_amount"] is not None
        ),
        "suspended_amount": sum(
            r["expected_amount"] for r in records
            if r["status"] == RecordStatus.SUSPENDED
        ),
        "status_counts": {
            RecordStatus.PENDING: 0,
            RecordStatus.CONFIRMED: 0,
            RecordStatus.SUSPENDED: 0,
            RecordStatus.DISCREPANCY: 0
        },
        "unconfirmed_amount": 0.0
    }

    for r in records:
        summary["status_counts"][r["status"]] = summary["status_counts"].get(r["status"], 0) + 1

    summary["unconfirmed_amount"] = (
        summary["total_expected"]
        - summary["confirmed_amount"]
        - summary["suspended_amount"]
    )

    return summary
