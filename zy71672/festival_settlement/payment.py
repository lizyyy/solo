import json
import os
from datetime import date, datetime as dt
from typing import List
import decimal

from .models import PaymentRecord, RecordStatus


def load_payments(input_dir: str) -> List[PaymentRecord]:
    pay_dir = os.path.join(input_dir, "payments")
    if not os.path.isdir(pay_dir):
        return []
    results = []
    for fname in sorted(os.listdir(pay_dir)):
        fpath = os.path.join(pay_dir, fname)
        if not fname.endswith(".json"):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = [data]
        for item in data:
            p = PaymentRecord(
                payment_id=item["payment_id"],
                artist_id=item["artist_id"],
                amount=decimal.Decimal(str(item["amount"])),
                payment_date=_parse_date(item["payment_date"]),
                payment_type=item.get("payment_type", "general"),
                reference_id=item.get("reference_id", ""),
                notes=item.get("notes", ""),
                status=RecordStatus(item.get("status", "pending")),
                source_file=os.path.basename(fpath),
            )
            results.append(p)
    return results


def _parse_date(val) -> date:
    if isinstance(val, date):
        return val
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return dt.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {val}")
