import os
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

import pandas as pd

from .models import (
    EvidenceRecord,
    EvidenceType,
    ReconciliationRecord,
    MatchStatus
)


def read_file(file_path: str) -> pd.DataFrame:
    ext = Path(file_path).suffix.lower()
    if ext == '.csv':
        return pd.read_csv(file_path, dtype=str)
    elif ext in ['.xlsx', '.xls']:
        return pd.read_excel(file_path, dtype=str)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def parse_amount(amount_str: Optional[str]) -> Optional[float]:
    if not amount_str or str(amount_str).strip() in ['', 'nan', 'None', 'null']:
        return None
    cleaned = str(amount_str).replace(',', '').replace('¥', '').replace('￥', '').strip()
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def load_expected_vouchers(file_path: str) -> List[ReconciliationRecord]:
    df = read_file(file_path)
    records = []

    required_cols = ['voucher_no', 'passenger_name', 'service_date', 'flight_no', 'expected_amount']
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"核销清单缺少必需列: {missing}")

    for _, row in df.iterrows():
        record = ReconciliationRecord(
            voucher_no=str(row['voucher_no']).strip(),
            passenger_name=str(row['passenger_name']).strip(),
            service_date=str(row['service_date']).strip(),
            flight_no=str(row['flight_no']).strip(),
            expected_amount=parse_amount(row['expected_amount']) or 0.0
        )
        records.append(record)

    return records


def load_payment_receipts(file_path: str) -> List[EvidenceRecord]:
    df = read_file(file_path)
    records = []

    for _, row in df.iterrows():
        amount = parse_amount(row.get('amount'))
        voucher_no = row.get('voucher_no', '')
        if voucher_no:
            voucher_no = str(voucher_no).strip()

        record = EvidenceRecord(
            evidence_type=EvidenceType.PAYMENT_RECEIPT,
            source_file=os.path.basename(file_path),
            content=f"收款流水: 金额{amount}元, 交易时间{row.get('transaction_time', '')}",
            amount=amount,
            voucher_no=voucher_no if voucher_no else None,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )
        records.append(record)

    return records


def load_refund_requests(file_path: str) -> List[EvidenceRecord]:
    df = read_file(file_path)
    records = []

    for _, row in df.iterrows():
        amount = parse_amount(row.get('refund_amount'))
        voucher_no = row.get('voucher_no', '')
        if voucher_no:
            voucher_no = str(voucher_no).strip()

        record = EvidenceRecord(
            evidence_type=EvidenceType.REFUND_REQUEST,
            source_file=os.path.basename(file_path),
            content=f"退款申请: 金额{amount}元, 原因{row.get('reason', '')}, 状态{row.get('status', '')}",
            amount=amount,
            voucher_no=voucher_no if voucher_no else None,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )
        records.append(record)

    return records


def load_approval_emails(file_path: str) -> List[EvidenceRecord]:
    df = read_file(file_path)
    records = []

    for _, row in df.iterrows():
        voucher_no = row.get('voucher_no', '')
        if voucher_no:
            voucher_no = str(voucher_no).strip()

        record = EvidenceRecord(
            evidence_type=EvidenceType.APPROVAL_EMAIL,
            source_file=os.path.basename(file_path),
            content=f"审批邮件: 审批人{row.get('approver', '')}, 意见{row.get('approval_opinion', '')}, 结果{row.get('approval_result', '')}",
            voucher_no=voucher_no if voucher_no else None,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )
        records.append(record)

    return records


def load_bank_receipts(file_path: str) -> List[EvidenceRecord]:
    df = read_file(file_path)
    records = []

    for _, row in df.iterrows():
        amount = parse_amount(row.get('amount'))
        voucher_no = row.get('voucher_no', '')
        if voucher_no:
            voucher_no = str(voucher_no).strip()

        record = EvidenceRecord(
            evidence_type=EvidenceType.BANK_RECEIPT,
            source_file=os.path.basename(file_path),
            content=f"银企回单截图: 金额{amount}元, 交易方{row.get('counterparty', '')}, 备注{row.get('remark', '')}",
            amount=amount,
            voucher_no=voucher_no if voucher_no else None,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )
        records.append(record)

    return records


def load_manual_notes(file_path: str) -> List[EvidenceRecord]:
    df = read_file(file_path)
    records = []

    for _, row in df.iterrows():
        voucher_no = row.get('voucher_no', '')
        if voucher_no:
            voucher_no = str(voucher_no).strip()

        record = EvidenceRecord(
            evidence_type=EvidenceType.MANUAL_NOTE,
            source_file=os.path.basename(file_path),
            content=f"手写备注: {row.get('note_content', '')}, 记录人{row.get('operator', '')}",
            voucher_no=voucher_no if voucher_no else None,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )
        records.append(record)

    return records


def load_attachment_index(file_path: str) -> Dict[str, List[EvidenceRecord]]:
    df = read_file(file_path)
    attachments: Dict[str, List[EvidenceRecord]] = {}

    for _, row in df.iterrows():
        voucher_no = str(row.get('voucher_no', '')).strip()
        if not voucher_no:
            continue

        record = EvidenceRecord(
            evidence_type=EvidenceType.ATTACHMENT,
            source_file=os.path.basename(file_path),
            content=f"附件: {row.get('attachment_name', '')}, 说明{row.get('description', '')}",
            voucher_no=voucher_no,
            passenger_name=str(row.get('passenger_name', '')).strip() or None,
            flight_no=str(row.get('flight_no', '')).strip() or None,
            service_date=str(row.get('service_date', '')).strip() or None
        )

        if voucher_no not in attachments:
            attachments[voucher_no] = []
        attachments[voucher_no].append(record)

    return attachments


def load_all_evidence(data_dir: str) -> Dict[str, List[EvidenceRecord]]:
    all_evidence: Dict[str, List[EvidenceRecord]] = {}

    if not os.path.exists(data_dir):
        return all_evidence

    for fname in os.listdir(data_dir):
        fpath = os.path.join(data_dir, fname)
        if not os.path.isfile(fpath):
            continue

        records = []
        fname_lower = fname.lower()

        try:
            if 'payment' in fname_lower or '收款' in fname_lower:
                records = load_payment_receipts(fpath)
            elif 'refund' in fname_lower or '退款' in fname_lower:
                records = load_refund_requests(fpath)
            elif 'approval' in fname_lower or '审批' in fname_lower:
                records = load_approval_emails(fpath)
            elif 'bank' in fname_lower or '回单' in fname_lower:
                records = load_bank_receipts(fpath)
            elif 'note' in fname_lower or '备注' in fname_lower:
                records = load_manual_notes(fpath)
        except Exception as e:
            print(f"警告: 读取文件 {fname} 时出错: {e}")
            continue

        for rec in records:
            if rec.voucher_no:
                if rec.voucher_no not in all_evidence:
                    all_evidence[rec.voucher_no] = []
                all_evidence[rec.voucher_no].append(rec)

    return all_evidence
