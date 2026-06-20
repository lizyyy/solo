import hashlib
import json
from datetime import datetime
from typing import Any, List, Optional

from models import RawRecord, ValidatedRecord


def compute_source_hash(records: List[RawRecord]) -> str:
    serializable = []
    for r in records:
        d = {
            "record_id": r.record_id,
            "category": r.category,
            "metric_name": r.metric_name,
            "value": r.value,
            "unit": r.unit,
            "dimension": r.dimension,
            "source": r.source,
            "is_late": r.is_late,
            "supplementary_note": r.supplementary_note,
        }
        serializable.append(d)
    serializable.sort(key=lambda x: x["record_id"])
    payload = json.dumps(serializable, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def format_number(v: Optional[float], ndigits: int = 2) -> str:
    if v is None:
        return "N/A"
    if abs(v - int(v)) < 1e-9:
        return str(int(v))
    return f"{round(v, ndigits)}"


def parse_date_safe(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    fmts = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ]
    for fmt in fmts:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def safe_div(a: float, b: float) -> Optional[float]:
    if b == 0:
        return None
    return a / b


def records_to_dicts(records: List[ValidatedRecord]) -> List[dict]:
    rows = []
    for vr in records:
        r = vr.raw
        rows.append({
            "record_id": r.record_id,
            "category": r.category,
            "metric_name": r.metric_name,
            "value": r.value,
            "unit": r.unit or "（缺失）",
            "dimension": r.dimension or "",
            "source": r.source,
            "status": vr.status.value,
            "standard_value": format_number(vr.standard_value),
            "standard_unit": vr.standard_unit or "",
            "can_release": "是" if vr.can_release else "否",
            "need_supplement": "；".join(vr.need_supplement) if vr.need_supplement else "无",
            "issues": "；".join(vr.issues) if vr.issues else "无",
            "is_late": "是" if r.is_late else "否",
            "supplementary_note": r.supplementary_note or "",
        })
    return rows
