import re
from datetime import datetime
from typing import Optional


CURRENCY_PATTERNS = {
    "USD": r"(?:USD|美元|\$)",
    "EUR": r"(?:EUR|欧元|€)",
    "CNY": r"(?:CNY|人民币|￥|RMB)",
    "GBP": r"(?:GBP|英镑|£)",
    "JPY": r"(?:JPY|日元|¥)",
    "HKD": r"(?:HKD|港币)",
}

DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y.%m.%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y年%m月%d日",
    "%Y年%m月",
    "%Y%m%d",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
]


def parse_amount(raw: Optional[str]) -> tuple[Optional[float], Optional[str]]:
    if not raw:
        return None, None
    raw = raw.strip()
    detected_currency = None
    for code, pattern in CURRENCY_PATTERNS.items():
        if re.search(pattern, raw, re.IGNORECASE):
            detected_currency = code
            break
    numeric_str = raw
    for pattern in CURRENCY_PATTERNS.values():
        numeric_str = re.sub(pattern, "", numeric_str, flags=re.IGNORECASE)
    numeric_str = numeric_str.replace(",", "").replace(" ", "").strip()
    if not numeric_str:
        return None, detected_currency
    try:
        amount = float(numeric_str)
        return amount, detected_currency
    except ValueError:
        return None, detected_currency


def parse_date(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    m = re.match(r"(\d{4})[年\-/.](\d{1,2})", raw)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), 1).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def check_voucher_completeness(record: dict) -> tuple[bool, Optional[str]]:
    has_voucher = bool(record.get("voucher_reference"))
    if not has_voucher:
        return False, "缺凭证编号，记录挂起，不进入已确认金额"
    return True, None


def detect_conflicts(imported: dict, screenshot: dict) -> list[dict]:
    conflicts = []
    fields_to_check = [
        ("amount", "金额"),
        ("currency", "币种"),
        ("date", "日期"),
        ("applicant", "申请人"),
        ("beneficiary", "受益人"),
    ]
    for field_key, field_label in fields_to_check:
        val_import = imported.get(field_key)
        val_screenshot = screenshot.get(field_key)
        if val_import is not None and val_screenshot is not None:
            str_import = str(val_import)
            str_screenshot = str(val_screenshot)
            if str_import != str_screenshot:
                conflicts.append({
                    "field_name": field_label,
                    "field_key": field_key,
                    "imported_value": str_import,
                    "screenshot_value": str_screenshot,
                    "suggested_action": f"请人工确认{field_label}：导入值为「{str_import}」，银企回单截图为「{str_screenshot}」",
                })
    return conflicts


def verify_record(record: dict, existing_in_batch: Optional[dict] = None) -> dict:
    result = {
        "amount": record.get("amount"),
        "currency": record.get("currency"),
        "date": record.get("date"),
        "has_voucher": True,
        "status": "pending",
        "conflict_detail": None,
        "suggested_action": None,
        "verification_note": [],
    }

    if record.get("amount_raw"):
        parsed_amount, parsed_currency = parse_amount(record["amount_raw"])
        if parsed_amount is not None:
            result["amount"] = parsed_amount
            result["verification_note"].append(
                f"金额清洗：「{record['amount_raw']}」→ {parsed_amount}"
            )
        else:
            result["verification_note"].append(
                f"金额清洗失败：无法从「{record['amount_raw']}」解析出数值"
            )
        if parsed_currency and not record.get("currency"):
            result["currency"] = parsed_currency
            result["verification_note"].append(
                f"币种识别：从金额文本识别出 {parsed_currency}"
            )
        elif record.get("currency"):
            result["currency"] = record["currency"]

    if record.get("date_raw"):
        parsed_date = parse_date(record["date_raw"])
        if parsed_date:
            result["date"] = parsed_date
            result["verification_note"].append(
                f"日期清洗：「{record['date_raw']}」→ {parsed_date}"
            )
        else:
            result["verification_note"].append(
                f"日期清洗失败：无法从「{record['date_raw']}」解析出标准日期"
            )

    voucher_ok, voucher_note = check_voucher_completeness(record)
    result["has_voucher"] = voucher_ok
    if not voucher_ok:
        result["verification_note"].append(voucher_note)

    if existing_in_batch:
        conflicts = detect_conflicts(record, existing_in_batch)
        if conflicts:
            result["status"] = "conflict"
            result["conflict_detail"] = conflicts
            result["suggested_action"] = "银企回单截图与导入数据存在冲突，请人工确认后再操作"
            conflict_fields = "、".join(c["field_name"] for c in conflicts)
            result["verification_note"].append(
                f"冲突检测：{conflict_fields}字段存在差异，已摆出双方证据"
            )
            return result

    if not voucher_ok:
        result["status"] = "suspended"
        result["suggested_action"] = "缺凭证，记录已挂起，待补证后确认"
        return result

    if result["amount"] is not None and result["date"] is not None:
        result["status"] = "confirmed"
        result["verification_note"].append("核验通过：金额、日期、凭证均齐全")
    elif result["amount"] is None or result["date"] is None:
        result["status"] = "pending"
        result["suggested_action"] = "关键信息缺失，待补全后重新核验"

    return result
