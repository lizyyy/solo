import re
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class CoordinateParseResult:
    decimal_degrees: float
    format_detected: str
    original: str


LAT_PATTERNS = [
    (re.compile(r'^(-?\d+\.?\d*)\s*°?\s*([NSns])?$'), 'decimal_deg'),
    (re.compile(r'^(\d+)\s*°\s*(\d+\.?\d*)\s*[\'′]\s*([NSns])?$'), 'deg_min'),
    (re.compile(r'^(\d+)\s*°\s*(\d+)\s*[\'′]\s*(\d+\.?\d*)\s*["″]\s*([NSns])?$'), 'deg_min_sec'),
    (re.compile(r'^(-?\d+\.\d+),?\s*(-?\d+\.\d+)?$'), 'decimal_only'),
]

LON_PATTERNS = [
    (re.compile(r'^(-?\d+\.?\d*)\s*°?\s*([EWew])?$'), 'decimal_deg'),
    (re.compile(r'^(\d+)\s*°\s*(\d+\.?\d*)\s*[\'′]\s*([EWew])?$'), 'deg_min'),
    (re.compile(r'^(\d+)\s*°\s*(\d+)\s*[\'′]\s*(\d+\.?\d*)\s*["″]\s*([EWew])?$'), 'deg_min_sec'),
    (re.compile(r'^(-?\d+\.\d+),?\s*(-?\d+\.\d+)?$'), 'decimal_only'),
]


def _parse_decimal(value: str, is_lat: bool) -> Optional[CoordinateParseResult]:
    try:
        val = float(value.strip())
        if is_lat and (val < -90 or val > 90):
            return None
        if not is_lat and (val < -180 or val > 180):
            return None
        return CoordinateParseResult(val, 'decimal_deg', value)
    except ValueError:
        return None


def _parse_deg_min(deg: str, minute: str, direction: Optional[str], is_lat: bool) -> Optional[CoordinateParseResult]:
    try:
        degrees = float(deg)
        minutes = float(minute)
        if minutes < 0 or minutes >= 60:
            return None
        decimal = degrees + minutes / 60.0
        if direction:
            if direction.upper() in ['S', 'W']:
                decimal = -decimal
        if is_lat and (decimal < -90 or decimal > 90):
            return None
        if not is_lat and (decimal < -180 or decimal > 180):
            return None
        return CoordinateParseResult(decimal, 'deg_min', f"{deg}°{minute}'{direction or ''}")
    except ValueError:
        return None


def _parse_deg_min_sec(deg: str, minute: str, sec: str, direction: Optional[str], is_lat: bool) -> Optional[CoordinateParseResult]:
    try:
        degrees = float(deg)
        minutes = float(minute)
        seconds = float(sec)
        if minutes < 0 or minutes >= 60 or seconds < 0 or seconds >= 60:
            return None
        decimal = degrees + minutes / 60.0 + seconds / 3600.0
        if direction:
            if direction.upper() in ['S', 'W']:
                decimal = -decimal
        if is_lat and (decimal < -90 or decimal > 90):
            return None
        if not is_lat and (decimal < -180 or decimal > 180):
            return None
        return CoordinateParseResult(decimal, 'deg_min_sec', f'{deg}°{minute}\'{sec}"{direction or ""}')
    except ValueError:
        return None


def parse_latitude(raw: str) -> Optional[CoordinateParseResult]:
    if raw is None:
        return None
    raw = str(raw).strip()
    if not raw:
        return None

    for pattern, fmt in LAT_PATTERNS:
        m = pattern.match(raw)
        if m:
            if fmt == 'decimal_deg':
                result = _parse_decimal(m.group(1), is_lat=True)
                if result and m.group(2):
                    if m.group(2).upper() == 'S' and result.decimal_degrees > 0:
                        result.decimal_degrees = -result.decimal_degrees
                    elif m.group(2).upper() == 'N' and result.decimal_degrees < 0:
                        result.decimal_degrees = abs(result.decimal_degrees)
                return result
            elif fmt == 'deg_min':
                return _parse_deg_min(m.group(1), m.group(2), m.group(3), is_lat=True)
            elif fmt == 'deg_min_sec':
                return _parse_deg_min_sec(m.group(1), m.group(2), m.group(3), m.group(4), is_lat=True)
            elif fmt == 'decimal_only':
                return _parse_decimal(m.group(1), is_lat=True)

    return None


def parse_longitude(raw: str) -> Optional[CoordinateParseResult]:
    if raw is None:
        return None
    raw = str(raw).strip()
    if not raw:
        return None

    for pattern, fmt in LON_PATTERNS:
        m = pattern.match(raw)
        if m:
            if fmt == 'decimal_deg':
                result = _parse_decimal(m.group(1), is_lat=False)
                if result and m.group(2):
                    if m.group(2).upper() == 'W' and result.decimal_degrees > 0:
                        result.decimal_degrees = -result.decimal_degrees
                    elif m.group(2).upper() == 'E' and result.decimal_degrees < 0:
                        result.decimal_degrees = abs(result.decimal_degrees)
                return result
            elif fmt == 'deg_min':
                return _parse_deg_min(m.group(1), m.group(2), m.group(3), is_lat=False)
            elif fmt == 'deg_min_sec':
                return _parse_deg_min_sec(m.group(1), m.group(2), m.group(3), m.group(4), is_lat=False)
            elif fmt == 'decimal_only':
                return _parse_decimal(m.group(1), is_lat=False)

    return None


def normalize_coordinates(lat_raw: str, lon_raw: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    lat_result = parse_latitude(lat_raw)
    lon_result = parse_longitude(lon_raw)

    lat_std = lat_result.decimal_degrees if lat_result else None
    lon_std = lon_result.decimal_degrees if lon_result else None

    format_info = None
    if lat_result and lon_result:
        if lat_result.format_detected == lon_result.format_detected:
            format_info = lat_result.format_detected
        else:
            format_info = f"lat:{lat_result.format_detected}|lon:{lon_result.format_detected}"
    elif lat_result:
        format_info = f"lat:{lat_result.format_detected}|lon:invalid"
    elif lon_result:
        format_info = f"lat:invalid|lon:{lon_result.format_detected}"
    else:
        format_info = "invalid"

    return lat_std, lon_std, format_info
