import re
from datetime import datetime, date
from typing import Optional, Tuple

OPERATOR_NICKNAME_MAP = {
    "老王": "王建国",
    "小李": "李明辉",
    "阿强": "赵强",
    "林姐": "林晓燕",
    "张哥": "张伟",
    "陈总": "陈志远",
    "刘姐": "刘美华",
}

CURRENCY_MAP = {
    "$": "USD",
    "￥": "CNY",
    "€": "EUR",
    "¥": "CNY",
    "USD": "USD",
    "CNY": "CNY",
    "EUR": "EUR",
}


def normalize_date(raw: str) -> Optional[date]:
    if not raw or str(raw).strip() == "":
        return None
    raw = str(raw).strip()
    patterns = [
        (r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", lambda m: date(int(m.group(1)), int(m.group(2)), int(m.group(3)))),
        (r"^(\d{4})年(\d{1,2})月(\d{1,2})日$", lambda m: date(int(m.group(1)), int(m.group(2)), int(m.group(3)))),
        (r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", lambda m: date(int(m.group(3)), int(m.group(1)), int(m.group(2)))),
        (r"^(\d{4})(\d{2})(\d{2})$", lambda m: date(int(m.group(1)), int(m.group(2)), int(m.group(3)))),
    ]
    for pattern, builder in patterns:
        m = re.match(pattern, raw)
        if m:
            try:
                return builder(m)
            except ValueError:
                continue
    try:
        dt = datetime.strptime(raw, "%m/%d/%Y")
        return dt.date()
    except ValueError:
        pass
    try:
        dt = datetime.strptime(raw, "%d-%b-%Y")
        return dt.date()
    except ValueError:
        pass
    try:
        f = float(raw)
        if 30000 < f < 60000:
            from datetime import datetime as dt2
            return dt2.fromordinal(int(f) - 693594).date()
        elif f > 40000:
            from datetime import datetime as dt2
            return dt2.fromordinal(int(f) - 693594).date()
    except (ValueError, OverflowError):
        pass
    return None


def normalize_amount(raw) -> Tuple[Optional[float], str]:
    if raw is None or str(raw).strip() == "":
        return None, ""
    raw_str = str(raw).strip()
    currency = ""
    for symbol, code in CURRENCY_MAP.items():
        if raw_str.startswith(symbol):
            currency = code
            raw_str = raw_str[len(symbol):].strip()
            break
    for symbol, code in CURRENCY_MAP.items():
        if raw_str.endswith(symbol):
            currency = code
            raw_str = raw_str[:-len(symbol)].strip()
            break
    raw_str = raw_str.replace(",", "").replace("，", "").replace(" ", "")
    if raw_str.startswith("(") and raw_str.endswith(")"):
        raw_str = "-" + raw_str[1:-1]
    try:
        amount = float(raw_str)
        return amount, currency
    except ValueError:
        return None, currency


def normalize_operator(raw: str) -> str:
    if not raw or str(raw).strip() == "":
        return ""
    raw = str(raw).strip()
    return OPERATOR_NICKNAME_MAP.get(raw, raw)
