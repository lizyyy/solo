import re
from typing import Optional, Tuple, List
from dataclasses import dataclass
from collections import namedtuple


@dataclass
class CoordinateParseResult:
    decimal_degrees: float
    format_detected: str
    original: str
    suggested_value: Optional[float] = None
    needs_confirmation: bool = False
    confirmation_reason: Optional[str] = None
    raw_segments: Optional[dict] = None


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

DIGITS_RE = re.compile(r'(\d+\.?\d*)')
DIRS_RE = re.compile(r'([NSEWnsew])')
SYMBOLS_RE = re.compile(r'([°\'′"″])')


def _validate_range(val: float, is_lat: bool) -> bool:
    if is_lat:
        return -90 <= val <= 90
    return -180 <= val <= 180


def _parse_decimal(value: str, is_lat: bool) -> Optional[CoordinateParseResult]:
    try:
        val = float(value.strip())
        if not _validate_range(val, is_lat):
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
        if not _validate_range(decimal, is_lat):
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
        if not _validate_range(decimal, is_lat):
            return None
        return CoordinateParseResult(decimal, 'deg_min_sec', f'{deg}°{minute}\'{sec}"{direction or ""}')
    except ValueError:
        return None


def _extract_segments(raw: str) -> Tuple[List[float], Optional[str], List[str]]:
    numbers = [float(x) for x in DIGITS_RE.findall(raw)]
    dirs = DIRS_RE.findall(raw)
    direction = dirs[0].upper() if dirs else None
    symbols = SYMBOLS_RE.findall(raw)
    return numbers, direction, symbols


def _try_fix_disordered_symbols(numbers: List[float], direction: Optional[str], symbols: List[str],
                                 raw: str, is_lat: bool) -> Optional[CoordinateParseResult]:
    if len(numbers) < 2 or '°' not in symbols:
        return None

    deg_idx = symbols.index('°')
    deg_val = numbers[0] if deg_idx >= 0 else None

    if deg_val is None:
        return None

    other_nums = numbers[1:]

    if len(other_nums) == 1:
        minutes = other_nums[0]
        if 0 <= minutes < 60:
            decimal = deg_val + minutes / 60.0
            if direction and direction.upper() in ['S', 'W']:
                decimal = -decimal
            if _validate_range(decimal, is_lat):
                return CoordinateParseResult(
                    decimal_degrees=decimal,
                    format_detected='deg_min_corrected',
                    original=raw,
                    suggested_value=None,
                    needs_confirmation=False,
                    confirmation_reason=None,
                    raw_segments={'deg': deg_val, 'min': minutes, 'dir': direction}
                )
        return None

    if len(other_nums) >= 2:
        candidate_min, candidate_sec = sorted(other_nums, reverse=True)

        if candidate_min >= 60 and candidate_sec >= 60:
            return None

        if candidate_min >= 60:
            candidate_min, candidate_sec = candidate_sec, candidate_min

        if 0 <= candidate_min < 60 and 0 <= candidate_sec < 60:
            decimal = deg_val + candidate_min / 60.0 + candidate_sec / 3600.0
            if direction and direction.upper() in ['S', 'W']:
                decimal = -decimal

            if _validate_range(decimal, is_lat):
                symbols_in_order = ''.join(symbols)
                is_obviously_disordered = symbols_in_order.find('″') < symbols_in_order.find('′') \
                    if '′' in symbols and '″' in symbols else False
                if "'" in symbols and '"' in symbols:
                    is_obviously_disordered = is_obviously_disordered or symbols.index('"') < symbols.index("'")

                if is_obviously_disordered:
                    return CoordinateParseResult(
                        decimal_degrees=decimal,
                        format_detected='deg_min_sec_corrected',
                        original=raw,
                        suggested_value=round(decimal, 6),
                        needs_confirmation=True,
                        confirmation_reason=f'经纬度符号顺序异常，已建议纠正为标准格式（{deg_val}°{int(candidate_min)}′{candidate_sec:g}″{direction or ""}），请人工确认',
                        raw_segments={'deg': deg_val, 'min': candidate_min, 'sec': candidate_sec, 'dir': direction}
                    )
                else:
                    return CoordinateParseResult(
                        decimal_degrees=decimal,
                        format_detected='deg_min_sec',
                        original=raw,
                        raw_segments={'deg': deg_val, 'min': candidate_min, 'sec': candidate_sec, 'dir': direction}
                    )

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

    numbers, direction, symbols = _extract_segments(raw)
    fixed = _try_fix_disordered_symbols(numbers, direction, symbols, raw, is_lat=True)
    if fixed:
        return fixed

    if numbers:
        if 1 <= len(numbers) <= 3:
            return CoordinateParseResult(
                decimal_degrees=0.0,
                format_detected='invalid_disordered',
                original=raw,
                suggested_value=None,
                needs_confirmation=True,
                confirmation_reason=f'经纬度格式异常（{raw}），无法可靠解析，请人工确认',
                raw_segments={'numbers': numbers, 'dir': direction, 'symbols': symbols}
            )

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

    numbers, direction, symbols = _extract_segments(raw)
    fixed = _try_fix_disordered_symbols(numbers, direction, symbols, raw, is_lat=False)
    if fixed:
        return fixed

    if numbers:
        if 1 <= len(numbers) <= 3:
            return CoordinateParseResult(
                decimal_degrees=0.0,
                format_detected='invalid_disordered',
                original=raw,
                suggested_value=None,
                needs_confirmation=True,
                confirmation_reason=f'经纬度格式异常（{raw}），无法可靠解析，请人工确认',
                raw_segments={'numbers': numbers, 'dir': direction, 'symbols': symbols}
            )

    return None


def normalize_coordinates(lat_raw: str, lon_raw: str) -> Tuple[Optional[float], Optional[float], Optional[str], bool, Optional[str], Optional[float], Optional[float]]:
    lat_result = parse_latitude(lat_raw)
    lon_result = parse_longitude(lon_raw)

    lat_std = lat_result.decimal_degrees if lat_result and not lat_result.needs_confirmation else None
    lon_std = lon_result.decimal_degrees if lon_result and not lon_result.needs_confirmation else None

    lat_suggested = lat_result.suggested_value if lat_result and lat_result.needs_confirmation else None
    lon_suggested = lon_result.suggested_value if lon_result and lon_result.needs_confirmation else None

    needs_confirm = False
    confirm_reason = None
    reasons = []
    if lat_result and lat_result.needs_confirmation and lat_result.confirmation_reason:
        reasons.append(f'纬度: {lat_result.confirmation_reason}')
    if lon_result and lon_result.needs_confirmation and lon_result.confirmation_reason:
        reasons.append(f'经度: {lon_result.confirmation_reason}')
    if reasons:
        needs_confirm = True
        confirm_reason = '; '.join(reasons)

    format_info = None
    lat_fmt = lat_result.format_detected if lat_result else 'invalid'
    lon_fmt = lon_result.format_detected if lon_result else 'invalid'
    if lat_fmt == lon_fmt:
        format_info = lat_fmt
    else:
        format_info = f"lat:{lat_fmt}|lon:{lon_fmt}"

    return lat_std, lon_std, format_info, needs_confirm, confirm_reason, lat_suggested, lon_suggested
