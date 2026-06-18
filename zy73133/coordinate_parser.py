from __future__ import annotations

import re
from typing import Tuple, Optional, List

from models import NormalizedCoordinates, CoordinateFormat


LAT_PATTERNS = [
    (re.compile(r'^(-?\d+\.?\d*)\s*°?\s*([NSns]?)$'), CoordinateFormat.DECIMAL),
    (re.compile(r'^(-?\d+)[°\s]\s*(\d+\.?\d*)\s*[\'′]?\s*([NSns]?)$'), CoordinateFormat.DDM),
    (re.compile(r'^(-?\d+)[°\s]\s*(\d+)[\'′\s]\s*(\d+\.?\d*)[\"″]?\s*([NSns]?)$'), CoordinateFormat.DMS),
]

LNG_PATTERNS = [
    (re.compile(r'^(-?\d+\.?\d*)\s*°?\s*([EWew]?)$'), CoordinateFormat.DECIMAL),
    (re.compile(r'^(-?\d+)[°\s]\s*(\d+\.?\d*)\s*[\'′]?\s*([EWew]?)$'), CoordinateFormat.DDM),
    (re.compile(r'^(-?\d+)[°\s]\s*(\d+)[\'′\s]\s*(\d+\.?\d*)[\"″]?\s*([EWew]?)$'), CoordinateFormat.DMS),
]


def _parse_single_value(raw: str, is_latitude: bool) -> Tuple[Optional[float], CoordinateFormat, List[str]]:
    notes: List[str] = []
    if raw is None:
        return None, CoordinateFormat.UNKNOWN, ["原始值为空"]

    cleaned = raw.strip().replace(' ', ' ')
    if not cleaned:
        return None, CoordinateFormat.UNKNOWN, ["原始值为空字符串"]

    patterns = LAT_PATTERNS if is_latitude else LNG_PATTERNS

    for pattern, fmt in patterns:
        m = pattern.match(cleaned)
        if not m:
            continue

        groups = m.groups()

        if fmt == CoordinateFormat.DECIMAL:
            value = float(groups[0])
            direction = groups[1].upper() if groups[1] else ''
            if direction in ('S', 'W') and value > 0:
                value = -value
                notes.append(f"检测到{direction}方向，数值取反")
            elif direction in ('N', 'E') and value < 0:
                value = abs(value)
                notes.append(f"检测到{direction}方向，负数取正")
            return value, fmt, notes

        elif fmt == CoordinateFormat.DDM:
            degrees = float(groups[0])
            minutes = float(groups[1])
            direction = groups[2].upper() if groups[2] else ''
            if minutes >= 60:
                notes.append(f"分({minutes})超过60，按60进制转换")
            value = abs(degrees) + minutes / 60.0
            if degrees < 0 or direction in ('S', 'W'):
                value = -value
            if direction:
                notes.append(f"按{direction}方向判定符号")
            return value, fmt, notes

        elif fmt == CoordinateFormat.DMS:
            degrees = float(groups[0])
            minutes = float(groups[1])
            seconds = float(groups[2])
            direction = groups[3].upper() if groups[3] else ''
            if minutes >= 60:
                notes.append(f"分({minutes})超过60，按60进制转换")
            if seconds >= 60:
                notes.append(f"秒({seconds})超过60，按60进制转换")
            value = abs(degrees) + minutes / 60.0 + seconds / 3600.0
            if degrees < 0 or direction in ('S', 'W'):
                value = -value
            if direction:
                notes.append(f"按{direction}方向判定符号")
            return value, fmt, notes

    raw_numeric = re.sub(r'[^0-9.\-]', '', cleaned)
    if raw_numeric and raw_numeric not in ('-', '.', '-.'):
        try:
            value = float(raw_numeric)
            notes.append(f"无法识别格式，按纯数值提取: {raw_numeric}")
            return value, CoordinateFormat.UNKNOWN, notes
        except ValueError:
            pass

    return None, CoordinateFormat.UNKNOWN, [f"无法解析坐标值: {cleaned}"]


def _validate_range(lat: float, lng: float) -> List[str]:
    issues: List[str] = []
    if not (-90 <= lat <= 90):
        issues.append(f"纬度 {lat} 超出有效范围 [-90, 90]")
    if not (-180 <= lng <= 180):
        issues.append(f"经度 {lng} 超出有效范围 [-180, 180]")
    return issues


def parse_coordinates(raw_latitude: str, raw_longitude: str) -> NormalizedCoordinates:
    lat_val, lat_fmt, lat_notes = _parse_single_value(raw_latitude, is_latitude=True)
    lng_val, lng_fmt, lng_notes = _parse_single_value(raw_longitude, is_latitude=False)

    all_notes = lat_notes + lng_notes

    if lat_val is not None and lng_val is not None:
        range_issues = _validate_range(lat_val, lng_val)
        all_notes.extend(range_issues)

    fmt = lat_fmt if lat_fmt == lng_fmt else (
        CoordinateFormat.DMS if lat_fmt == CoordinateFormat.DMS or lng_fmt == CoordinateFormat.DMS
        else CoordinateFormat.DDM if lat_fmt == CoordinateFormat.DDM or lng_fmt == CoordinateFormat.DDM
        else CoordinateFormat.DECIMAL if lat_fmt == CoordinateFormat.DECIMAL or lng_fmt == CoordinateFormat.DECIMAL
        else CoordinateFormat.UNKNOWN
    )

    if lat_fmt != lng_fmt:
        all_notes.append(
            f"经纬格式不一致: 纬度={lat_fmt.value}, 经度={lng_fmt.value}，统一按 {fmt.value} 记录"
        )

    return NormalizedCoordinates(
        latitude=lat_val if lat_val is not None else 0.0,
        longitude=lng_val if lng_val is not None else 0.0,
        original_format=fmt,
        raw_latitude=raw_latitude,
        raw_longitude=raw_longitude,
        parse_notes=all_notes
    )
