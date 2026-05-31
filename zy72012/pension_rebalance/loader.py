import csv
import os
from datetime import datetime
from typing import List, Optional, Tuple

from pension_rebalance.models import Receipt, Refund, Approval, Note


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _safe_float(val: str) -> Tuple[Optional[float], str]:
    raw = val.strip() if val else ""
    if not raw:
        return None, raw
    try:
        return float(raw), raw
    except ValueError:
        return None, raw


def load_receipts(path: str) -> Tuple[List[Receipt], List[str]]:
    results: List[Receipt] = []
    warnings: List[str] = []
    basename = os.path.basename(path)
    loaded_at = _now()

    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            txn_id = (row.get("交易流水号") or "").strip()
            fund_code_raw = (row.get("基金代码") or "").strip()
            amount_raw = (row.get("金额") or "").strip()
            date_raw = (row.get("交易日期") or "").strip()
            counterparty = (row.get("对方账户") or "").strip()
            status = (row.get("状态") or "").strip()

            amount_val, _ = _safe_float(amount_raw)

            if not txn_id:
                warnings.append(f"{basename} 第{i}行: 交易流水号为空，跳过")
                continue

            r = Receipt(
                transaction_id=txn_id,
                fund_code=fund_code_raw,
                amount=amount_val,
                date=date_raw,
                counterparty=counterparty,
                status=status,
                source_file=basename,
                loaded_at=loaded_at,
                raw_amount=amount_raw,
                raw_fund_code=fund_code_raw,
                raw_date=date_raw,
            )

            if amount_val is None and amount_raw:
                warnings.append(f"{basename} 第{i}行 交易{txn_id}: 金额'{amount_raw}'无法解析为数字")
            if not fund_code_raw:
                warnings.append(f"{basename} 第{i}行 交易{txn_id}: 基金代码为空")
            if not date_raw:
                warnings.append(f"{basename} 第{i}行 交易{txn_id}: 交易日期为空")

            results.append(r)

    return results, warnings


def load_refunds(path: str) -> Tuple[List[Refund], List[str]]:
    results: List[Refund] = []
    warnings: List[str] = []
    basename = os.path.basename(path)
    loaded_at = _now()

    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            refund_id = (row.get("退款申请号") or "").strip()
            txn_id_raw = (row.get("关联交易流水号") or "").strip()
            fund_code = (row.get("基金代码") or "").strip()
            amount_raw = (row.get("退款金额") or "").strip()
            reason = (row.get("退款原因") or "").strip()
            apply_date = (row.get("申请日期") or "").strip()
            status = (row.get("状态") or "").strip()

            amount_val, _ = _safe_float(amount_raw)

            if not refund_id:
                warnings.append(f"{basename} 第{i}行: 退款申请号为空，跳过")
                continue

            r = Refund(
                refund_id=refund_id,
                transaction_id=txn_id_raw,
                fund_code=fund_code,
                amount=amount_val,
                reason=reason,
                apply_date=apply_date,
                status=status,
                source_file=basename,
                loaded_at=loaded_at,
                raw_amount=amount_raw,
                raw_transaction_id=txn_id_raw,
            )

            if not txn_id_raw:
                warnings.append(f"{basename} 第{i}行 退款{refund_id}: 关联交易流水号为空")
            if amount_val is None and amount_raw:
                warnings.append(f"{basename} 第{i}行 退款{refund_id}: 金额'{amount_raw}'无法解析为数字")

            results.append(r)

    return results, warnings


def load_approvals(path: str) -> Tuple[List[Approval], List[str]]:
    results: List[Approval] = []
    warnings: List[str] = []
    basename = os.path.basename(path)
    loaded_at = _now()

    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            approval_id = (row.get("审批编号") or "").strip()
            refund_id = (row.get("关联退款申请号") or "").strip()
            approver = (row.get("审批人") or "").strip()
            approve_date = (row.get("审批日期") or "").strip()
            result = (row.get("审批结果") or "").strip()
            attachment_ref = (row.get("附件引用") or "").strip()

            if not approval_id:
                warnings.append(f"{basename} 第{i}行: 审批编号为空，跳过")
                continue

            a = Approval(
                approval_id=approval_id,
                refund_id=refund_id,
                approver=approver,
                approve_date=approve_date,
                result=result,
                attachment_ref=attachment_ref,
                source_file=basename,
                loaded_at=loaded_at,
            )

            if not approver:
                warnings.append(f"{basename} 第{i}行 审批{approval_id}: 审批人为空")
            if not refund_id:
                warnings.append(f"{basename} 第{i}行 审批{approval_id}: 关联退款申请号为空")

            results.append(a)

    return results, warnings


def load_notes(path: str) -> Tuple[List[Note], List[str]]:
    results: List[Note] = []
    warnings: List[str] = []
    basename = os.path.basename(path)
    loaded_at = _now()

    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            note_id = (row.get("备注编号") or "").strip()
            txn_id = (row.get("关联交易流水号") or "").strip()
            content = (row.get("备注内容") or "").strip()
            author = (row.get("记录人") or "").strip()
            note_date = (row.get("记录日期") or "").strip()
            source = (row.get("来源") or "").strip()

            if not note_id:
                warnings.append(f"{basename} 第{i}行: 备注编号为空，跳过")
                continue

            n = Note(
                note_id=note_id,
                transaction_id=txn_id,
                content=content,
                author=author,
                note_date=note_date,
                source=source,
                source_file=basename,
                loaded_at=loaded_at,
            )

            if not txn_id:
                warnings.append(f"{basename} 第{i}行 备注{note_id}: 关联交易流水号为空")

            results.append(n)

    return results, warnings


def load_all(data_dir: str) -> dict:
    all_warnings: List[str] = []

    receipts, w = load_receipts(os.path.join(data_dir, "receipts.csv"))
    all_warnings.extend(w)

    refunds, w = load_refunds(os.path.join(data_dir, "refunds.csv"))
    all_warnings.extend(w)

    approvals, w = load_approvals(os.path.join(data_dir, "approvals.csv"))
    all_warnings.extend(w)

    notes, w = load_notes(os.path.join(data_dir, "notes.csv"))
    all_warnings.extend(w)

    for fname in sorted(os.listdir(data_dir)):
        fpath = os.path.join(data_dir, fname)
        if not os.path.isfile(fpath):
            continue
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            try:
                import pandas as pd
                df = pd.read_excel(fpath)
                all_warnings.append(f"{fname}: Excel文件已发现({len(df)}行)，但需转为CSV或补充解析逻辑后使用")
            except Exception as e:
                all_warnings.append(f"{fname}: Excel文件读取失败 - {e}")

    return {
        "receipts": receipts,
        "refunds": refunds,
        "approvals": approvals,
        "notes": notes,
        "warnings": all_warnings,
    }
