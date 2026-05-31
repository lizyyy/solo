import re
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Tuple


NICKNAME_MAP = {
    "老王": "王建国",
    "小张": "张伟",
    "小刘": "刘芳",
    "赵姐": "赵敏",
}

DATE_FORMATS = [
    "%Y/%m/%d",
    "%Y-%m-%d",
    "%d-%b-%Y",
    "%Y%m%d",
    "%m月%d日",
]


@dataclass
class NormalizedRecord:
    record_id: str
    raw_date: str
    date: Optional[datetime]
    raw_amount: str
    amount: Optional[float]
    currency: str
    raw_handler: str
    handler: str
    department: str
    vendor: str
    purpose: str
    budget_code: str
    approval_ref: str
    remark: str
    normalization_notes: List[str] = field(default_factory=list)

    @property
    def date_str(self) -> str:
        if self.date:
            return self.date.strftime("%Y-%m-%d")
        return ""

    @property
    def amount_str(self) -> str:
        if self.amount is not None:
            return f"{self.currency} {self.amount:,.2f}"
        return ""


def normalize_date(raw: str) -> Tuple[Optional[datetime], str]:
    if not raw or not raw.strip():
        return None, "日期为空"
    raw = raw.strip()
    m = re.match(r"(\d{1,2})月(\d{1,2})日", raw)
    if m:
        try:
            return datetime(2024, int(m.group(1)), int(m.group(2))), f"从'{raw}'推断年份2024"
        except ValueError:
            return None, f"日期'{raw}'无效"
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt), ""
        except ValueError:
            continue
    return None, f"日期'{raw}'格式无法识别"


def normalize_amount(raw: str) -> Tuple[Optional[float], str, str]:
    if not raw or not raw.strip():
        return None, "", "金额为空"
    raw = raw.strip()
    currency = "CNY"
    note = ""
    currency_match = re.match(r"^(CNY|RMB|USD|EUR|¥)\s*", raw)
    if currency_match:
        c = currency_match.group(1)
        if c == "¥":
            currency = "CNY"
        elif c in ("CNY", "RMB"):
            currency = "CNY"
        else:
            currency = c
        raw = raw[currency_match.end():]
    wan_match = re.match(r"([\d.]+)\s*万", raw)
    if wan_match:
        try:
            amount = float(wan_match.group(1)) * 10000
            note = f"金额'{raw}'按万元换算"
            return amount, currency, note
        except ValueError:
            return None, currency, f"金额'{raw}'无效"
    cleaned = raw.replace(",", "").replace("，", "").strip()
    try:
        amount = float(cleaned)
        return amount, currency, note
    except ValueError:
        return None, currency, f"金额'{raw}'无法解析"


def normalize_handler(raw: str) -> Tuple[str, str]:
    if not raw or not raw.strip():
        return "", "经办人为空"
    raw = raw.strip()
    if raw in NICKNAME_MAP:
        real = NICKNAME_MAP[raw]
        return real, f"经办人'{raw}'→'{real}'"
    return raw, ""


def normalize_record(row: dict) -> NormalizedRecord:
    notes = []
    date, date_note = normalize_date(str(row.get("交易日期", "")))
    if date_note:
        notes.append(date_note)
    amount, currency, amount_note = normalize_amount(str(row.get("金额", "")))
    if amount_note:
        notes.append(amount_note)
    handler, handler_note = normalize_handler(str(row.get("经办人", "")))
    if handler_note:
        notes.append(handler_note)
    return NormalizedRecord(
        record_id=str(row.get("记录编号", "")).strip(),
        raw_date=str(row.get("交易日期", "")),
        date=date,
        raw_amount=str(row.get("金额", "")),
        amount=amount,
        currency=currency,
        raw_handler=str(row.get("经办人", "")),
        handler=handler,
        department=str(row.get("部门", "")).strip(),
        vendor=str(row.get("供应商", "")).strip(),
        purpose=str(row.get("用途", "")).strip(),
        budget_code=str(row.get("预算科目", "")).strip(),
        approval_ref=str(row.get("审批单号", "")).strip(),
        remark=str(row.get("备注", "")).strip(),
        normalization_notes=notes,
    )
