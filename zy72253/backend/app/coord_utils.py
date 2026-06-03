from typing import Optional
import re
from .models import CoordType


_LATLNG_PATTERN = re.compile(
    r"[+-]?\d{1,3}(\.\d+)?[°]?\s*[NS]?\s*[,/]\s*[+-]?\d{1,3}(\.\d+)?[°]?\s*[EW]?"
)
_LATLNG_DECIMAL = re.compile(
    r"[+-]?\d{1,2}\.\d{4,}"
)
_METRIC_PATTERN = re.compile(
    r"[+-]?\d+\.?\d*\s*(mm|cm|m|M|米|毫米|厘米)"
)
_METRIC_TRIPLE = re.compile(
    r"[+-]?\d+\.?\d*\s*[,xX]\s*[+-]?\d+\.?\d*\s*[,xX]\s*[+-]?\d+\.?\d*"
)


def detect_coord_type(raw_data: str) -> CoordType:
    has_latlng = bool(_LATLNG_PATTERN.search(raw_data)) or bool(_LATLNG_DECIMAL.search(raw_data))
    has_metric = bool(_METRIC_PATTERN.search(raw_data)) or bool(_METRIC_TRIPLE.search(raw_data))
    if has_latlng and has_metric:
        return CoordType.MIXED
    if has_latlng:
        return CoordType.LATLNG
    if has_metric:
        return CoordType.METRIC
    return CoordType.METRIC


def compute_record_hash(batch_id: str, raw_data: str, recorded_at: Optional[str] = None) -> str:
    import hashlib
    payload = f"{batch_id}|{raw_data}|{recorded_at or ''}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
