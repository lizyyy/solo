from typing import Optional, Tuple
import re
from .models import CoordType


_LATLNG_PATTERN = re.compile(
    r"[+-]?\d{1,3}(\.\d+)?[°]?\s*[NS]?\s*[,/]\s*[+-]?\d{1,3}(\.\d+)?[°]?\s*[EW]?"
)
_LATLNG_DECIMAL = re.compile(
    r"[+-]?\d{1,2}\.\d{4,}"
)

_METRIC_COORD_PREFIX = re.compile(
    r"(?:^|\s)([XYZxyz]):\s*[+-]?\d+\.?\d*\s*(?:mm|cm|m|M|米|毫米|厘米)"
)
_METRIC_TRIPLE = re.compile(
    r"[+-]?\d+\.?\d*\s*(?:mm|cm|m|M|米|毫米|厘米)?\s*[,xX]\s*[+-]?\d+\.?\d*\s*(?:mm|cm|m|M|米|毫米|厘米)?\s*[,xX]\s*[+-]?\d+\.?\d*\s*(?:mm|cm|m|M|米|毫米|厘米)?"
)

_DISTANCE_WITH_PREFIX = re.compile(
    r"(?:^|\s)(?:距离|D|d|测距)\s*[:：]?\s*[+-]?\d+\.?\d*\s*(?:mm|cm|m|M|米|毫米|厘米)"
)
_UNIT_ONLY = re.compile(
    r"(?:^|\s)([+-]?\d+\.?\d*)\s*(mm|cm|m|M|米|毫米|厘米)"
)


def _strip_latlng(raw: str) -> str:
    s = _LATLNG_PATTERN.sub('', raw)
    s = re.sub(r'[+-]?\d{1,2}\.\d{4,}', '', s)
    return s


def detect_coord_type(raw_data: str) -> CoordType:
    has_latlng = bool(_LATLNG_PATTERN.search(raw_data)) or bool(_LATLNG_DECIMAL.search(raw_data))
    has_metric_prefix = bool(_METRIC_COORD_PREFIX.search(raw_data))

    if has_latlng and has_metric_prefix:
        return CoordType.MIXED

    if has_latlng:
        has_distance_prefix = bool(_DISTANCE_WITH_PREFIX.search(raw_data))
        if has_distance_prefix and not has_metric_prefix:
            return CoordType.LATLNG_WITH_DISTANCE

        rest = _strip_latlng(raw_data)
        has_standalone_unit = bool(_UNIT_ONLY.search(rest))
        if has_standalone_unit and not has_metric_prefix:
            return CoordType.LATLNG_WITH_DISTANCE

        return CoordType.LATLNG

    if has_metric_prefix:
        return CoordType.METRIC

    if bool(_METRIC_TRIPLE.search(raw_data)):
        return CoordType.METRIC

    if bool(_DISTANCE_WITH_PREFIX.search(raw_data)):
        return CoordType.METRIC

    if bool(_UNIT_ONLY.search(raw_data)):
        return CoordType.METRIC

    return CoordType.METRIC


def compute_record_hash(batch_id: str, raw_data: str, recorded_at: Optional[str] = None) -> str:
    import hashlib
    payload = f"{batch_id}|{raw_data}|{recorded_at or ''}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
