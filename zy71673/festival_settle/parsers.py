import csv
import hashlib
from decimal import Decimal, InvalidOperation
from typing import List, Tuple, Optional
from .models import Contract, BoxOfficeRecord, SponsorRecord, PaymentRecord, RecordStatus


def _content_hash(*fields) -> str:
    payload = "|".join(str(f) for f in fields)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _safe_decimal(val) -> Decimal:
    if val is None:
        return Decimal("0")
    s = str(val).strip().replace(",", "").replace("％", "").replace("%", "")
    if s == "" or s == "-":
        return Decimal("0")
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal("0")


def _safe_int(val) -> int:
    if val is None:
        return 0
    s = str(val).strip().replace(",", "")
    if s == "" or s == "-":
        return 0
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return 0


def _ratio_to_decimal(val) -> Decimal:
    d = _safe_decimal(val)
    if d > Decimal("1"):
        return d / Decimal("100")
    return d


FIELD_MAPS = {
    "contracts": {
        "artist_name": ["艺人", "artist_name", "艺人名称", "艺术家", "姓名"],
        "guarantee_amount": ["保底", "guarantee_amount", "保底金额", "保底费", "最低保障"],
        "revenue_share_ratio": ["分成比例", "revenue_share_ratio", "分成", "票房分成", "比例"],
        "sponsor_clause": ["赞助条款", "sponsor_clause", "赞助", "赞助合约"],
        "performance_slot": ["演出时段", "performance_slot", "时段", "演出时间"],
        "remarks": ["备注", "remarks", "说明", "人工备注"],
    },
    "box_office": {
        "date": ["日期", "date", "演出日期", "结算日期"],
        "artist_name": ["艺人", "artist_name", "艺人名称", "艺术家"],
        "ticket_revenue": ["票款", "ticket_revenue", "票房", "票房收入", "门票收入"],
        "ticket_count": ["票数", "ticket_count", "售票数", "门票数"],
        "performance_slot": ["演出时段", "performance_slot", "时段"],
        "remarks": ["备注", "remarks", "说明"],
    },
    "sponsors": {
        "sponsor_name": ["赞助商", "sponsor_name", "赞助方"],
        "artist_name": ["艺人", "artist_name", "艺人名称"],
        "exposure_amount": ["露出金额", "exposure_amount", "赞助金额", "露出费"],
        "deduction_amount": ["扣款金额", "deduction_amount", "扣款", "抵扣"],
        "remarks": ["备注", "remarks", "说明"],
    },
    "payments": {
        "artist_name": ["艺人", "artist_name", "艺人名称"],
        "amount": ["金额", "amount", "付款金额", "支付金额"],
        "payment_date": ["付款日期", "payment_date", "日期", "支付日期"],
        "payment_type": ["付款类型", "payment_type", "类型", "款项类型"],
        "remarks": ["备注", "remarks", "说明"],
    },
}


def _resolve_columns(headers: List[str], table_name: str) -> dict:
    mapping = {}
    headers_lower = [h.strip().lower() for h in headers]
    for canonical, aliases in FIELD_MAPS[table_name].items():
        aliases_lower = [a.lower() for a in aliases]
        for i, h in enumerate(headers_lower):
            if h in aliases_lower:
                mapping[canonical] = headers[i]
                break
        if canonical not in mapping:
            for i, h in enumerate(headers_lower):
                for alias in aliases_lower:
                    if alias in h or h in alias:
                        mapping[canonical] = headers[i]
                        break
                if canonical in mapping:
                    break
    return mapping


def parse_contracts(filepath: str, now: str) -> List[Contract]:
    records = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        col_map = _resolve_columns(reader.fieldnames or [], "contracts")
        for row in reader:
            artist = row.get(col_map.get("artist_name", ""), "").strip()
            if not artist:
                continue
            guarantee = _safe_decimal(row.get(col_map.get("guarantee_amount", ""), "0"))
            ratio = _ratio_to_decimal(row.get(col_map.get("revenue_share_ratio", ""), "0"))
            clause = row.get(col_map.get("sponsor_clause", ""), "").strip()
            slot = row.get(col_map.get("performance_slot", ""), "").strip()
            remarks = row.get(col_map.get("remarks", ""), "").strip()
            chash = _content_hash(artist, guarantee, ratio, clause, slot)
            records.append(Contract(
                artist_name=artist,
                guarantee_amount=guarantee,
                revenue_share_ratio=ratio,
                sponsor_clause=clause,
                performance_slot=slot,
                remarks=remarks,
                content_hash=chash,
                status=RecordStatus.PROVISIONAL,
                created_at=now,
            ))
    records.sort(key=lambda c: c.artist_name)
    return records


def parse_box_office(filepath: str, now: str) -> List[BoxOfficeRecord]:
    records = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        col_map = _resolve_columns(reader.fieldnames or [], "box_office")
        for row in reader:
            artist = row.get(col_map.get("artist_name", ""), "").strip()
            if not artist:
                continue
            date = row.get(col_map.get("date", ""), "").strip()
            revenue = _safe_decimal(row.get(col_map.get("ticket_revenue", ""), "0"))
            count = _safe_int(row.get(col_map.get("ticket_count", ""), "0"))
            slot = row.get(col_map.get("performance_slot", ""), "").strip()
            remarks = row.get(col_map.get("remarks", ""), "").strip()
            chash = _content_hash(artist, date, revenue, count, slot)
            records.append(BoxOfficeRecord(
                date=date,
                artist_name=artist,
                ticket_revenue=revenue,
                ticket_count=count,
                performance_slot=slot,
                remarks=remarks,
                content_hash=chash,
                status=RecordStatus.PROVISIONAL,
                created_at=now,
            ))
    records.sort(key=lambda r: (r.artist_name, r.date))
    return records


def parse_sponsors(filepath: str, now: str) -> List[SponsorRecord]:
    records = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        col_map = _resolve_columns(reader.fieldnames or [], "sponsors")
        for row in reader:
            artist = row.get(col_map.get("artist_name", ""), "").strip()
            if not artist:
                continue
            sponsor = row.get(col_map.get("sponsor_name", ""), "").strip()
            exposure = _safe_decimal(row.get(col_map.get("exposure_amount", ""), "0"))
            deduction = _safe_decimal(row.get(col_map.get("deduction_amount", ""), "0"))
            remarks = row.get(col_map.get("remarks", ""), "").strip()
            chash = _content_hash(artist, sponsor, exposure, deduction)
            records.append(SponsorRecord(
                sponsor_name=sponsor,
                artist_name=artist,
                exposure_amount=exposure,
                deduction_amount=deduction,
                remarks=remarks,
                content_hash=chash,
                status=RecordStatus.PROVISIONAL,
                created_at=now,
            ))
    records.sort(key=lambda r: (r.artist_name, r.sponsor_name))
    return records


def parse_payments(filepath: str, now: str) -> List[PaymentRecord]:
    records = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        col_map = _resolve_columns(reader.fieldnames or [], "payments")
        for row in reader:
            artist = row.get(col_map.get("artist_name", ""), "").strip()
            if not artist:
                continue
            amount = _safe_decimal(row.get(col_map.get("amount", ""), "0"))
            pdate = row.get(col_map.get("payment_date", ""), "").strip()
            ptype = row.get(col_map.get("payment_type", ""), "").strip()
            remarks = row.get(col_map.get("remarks", ""), "").strip()
            chash = _content_hash(artist, amount, pdate, ptype)
            records.append(PaymentRecord(
                artist_name=artist,
                amount=amount,
                payment_date=pdate,
                payment_type=ptype,
                remarks=remarks,
                content_hash=chash,
                status=RecordStatus.PROVISIONAL,
                created_at=now,
            ))
    records.sort(key=lambda r: (r.artist_name, r.payment_date))
    return records


FILE_PATTERNS = {
    "contracts": ["合同", "contract", "合约"],
    "box_office": ["票房", "box_office", "售票", "票款"],
    "sponsors": ["赞助", "sponsor", "赞助商"],
    "payments": ["付款", "payment", "支付", "付款记录"],
}


def classify_file(filename: str) -> Optional[str]:
    lower = filename.lower()
    for table, patterns in FILE_PATTERNS.items():
        for pat in patterns:
            if pat in lower:
                return table
    return None
