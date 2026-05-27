from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import List

from .schemas import PackageRow, ReturnRule, SmsRecord


def _parse_dt(v: str) -> datetime:
    v = (v or "").strip()
    if not v:
        return datetime.now()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(v)


def parse_packages_csv(csv_bytes: bytes) -> List[PackageRow]:
    text = csv_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    packages: List[PackageRow] = []
    for row in reader:
        packages.append(
            PackageRow(
                tracking_no=(row.get("tracking_no") or row.get("运单号") or "").strip(),
                recipient_phone=(row.get("recipient_phone") or row.get("手机号") or "").strip(),
                recipient_name=(row.get("recipient_name") or row.get("收件人") or "").strip() or None,
                inbound_at=_parse_dt(row.get("inbound_at") or row.get("入库时间") or ""),
                status=(row.get("status") or row.get("状态") or "in_storage").strip(),
                station_id=(row.get("station_id") or row.get("驿站编号") or "").strip() or None,
                raw=row,
            )
        )
    return packages


def parse_sms_json(data: bytes) -> List[SmsRecord]:
    items = json.loads(data.decode("utf-8"))
    if isinstance(items, dict) and "records" in items:
        items = items["records"]
    return [SmsRecord(**item) for item in items]


def parse_rules_json(data: bytes) -> List[ReturnRule]:
    items = json.loads(data.decode("utf-8"))
    if isinstance(items, dict) and "rules" in items:
        items = items["rules"]
    return [ReturnRule(**item) for item in items]
