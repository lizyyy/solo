from datetime import datetime, date

def parse_date(date_str):
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None

def format_date(d):
    if not d:
        return ""
    if isinstance(d, date):
        return d.strftime("%Y-%m-%d")
    if isinstance(d, str):
        parsed = parse_date(d)
        return parsed.strftime("%Y-%m-%d") if parsed else d
    return str(d)

def days_between(start, end):
    if not start or not end:
        return None
    s = parse_date(start) if isinstance(start, str) else start
    e = parse_date(end) if isinstance(end, str) else end
    if s and e:
        return (e - s).days
    return None

def is_valid_purchase_date(purchase_date_str):
    if not purchase_date_str:
        return False
    purchase_date = parse_date(purchase_date_str)
    if not purchase_date:
        return False
    today = date.today()
    if purchase_date > today:
        return False
    if purchase_date.year < 1990:
        return False
    return True
