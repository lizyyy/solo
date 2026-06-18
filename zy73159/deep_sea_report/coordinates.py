"""经纬度解析与反写检测模块."""

import re
from typing import Tuple, Optional, List
from .models import CoordinateIssue


LAT_PATTERNS = [
    re.compile(r'^([+-]?\d+\.?\d*)\s*[°度]\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?\s*([NSns])\s*$'),
    re.compile(r'^([+-]?\d+\.?\d*)\s*[°度]\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?\s*([NSns])?$'),
    re.compile(r'^([NSns])\s*([+-]?\d+\.?\d*)\s*[°度]?\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?$'),
    re.compile(r'^([+-]?\d+\.?\d*)\s+([NSns])\s*$'),
    re.compile(r'^([+-]?\d+\.?\d*)$'),
]

LON_PATTERNS = [
    re.compile(r'^([+-]?\d+\.?\d*)\s*[°度]\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?\s*([EWew])\s*$'),
    re.compile(r'^([+-]?\d+\.?\d*)\s*[°度]\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?\s*([EWew])?$'),
    re.compile(r'^([EWew])\s*([+-]?\d+\.?\d*)\s*[°度]?\s*(\d+\.?\d*)?\s*[\'′分]?\s*(\d+\.?\d*)?\s*[\"″秒]?$'),
    re.compile(r'^([+-]?\d+\.?\d*)\s+([EWew])\s*$'),
    re.compile(r'^([+-]?\d+\.?\d*)$'),
]


def _dms_to_decimal(degrees: float, minutes: float = 0.0, seconds: float = 0.0,
                    hemisphere: Optional[str] = None) -> float:
    """度分秒转十进制度."""
    decimal = abs(degrees) + minutes / 60.0 + seconds / 3600.0
    if hemisphere and hemisphere.upper() in ('S', 'W'):
        decimal = -decimal
    if degrees < 0:
        decimal = -decimal
    return decimal


def _safe_float(val) -> float:
    """安全转float，None或空串返回0."""
    if val is None or val == '':
        return 0.0
    return float(val)


def parse_latitude(raw: str) -> Tuple[Optional[float], List[CoordinateIssue], int]:
    """解析纬度值，返回(十进制度值, 问题列表, 原始行号占位)."""
    issues = []
    raw_stripped = raw.strip()
    if not raw_stripped:
        issues.append(CoordinateIssue(
            issue_type="纬度缺失",
            description="纬度字段为空",
            source_line=0,
            raw_value=raw,
        ))
        return None, issues, 0

    for pattern in LAT_PATTERNS:
        match = pattern.match(raw_stripped)
        if not match:
            continue
        groups = match.groups()
        try:
            num_groups = len(groups)

            if num_groups == 1:
                degrees = _safe_float(groups[0])
                minutes = 0.0
                seconds = 0.0
                hemisphere = None
            elif num_groups == 2 and groups[1] and groups[1].upper() in ('N', 'S'):
                degrees = _safe_float(groups[0])
                minutes = 0.0
                seconds = 0.0
                hemisphere = groups[1]
            elif num_groups == 4 and groups[0] and groups[0].upper() in ('N', 'S'):
                hemisphere = groups[0]
                degrees = _safe_float(groups[1])
                minutes = _safe_float(groups[2])
                seconds = _safe_float(groups[3])
            else:
                degrees = _safe_float(groups[0])
                minutes = _safe_float(groups[1]) if num_groups > 1 else 0.0
                seconds = _safe_float(groups[2]) if num_groups > 2 else 0.0
                hemisphere = groups[3] if num_groups > 3 and groups[3] else None

            value = _dms_to_decimal(degrees, minutes, seconds, hemisphere)

            if abs(value) > 90:
                issues.append(CoordinateIssue(
                    issue_type="纬度越界",
                    description=f"纬度值 {value} 超出 -90~90 范围，疑似经纬度反写",
                    source_line=0,
                    raw_value=raw,
                ))
            return value, issues, 0
        except (ValueError, IndexError):
            continue

    issues.append(CoordinateIssue(
        issue_type="纬度格式无法识别",
        description=f"无法解析纬度: {raw_stripped}",
        source_line=0,
        raw_value=raw,
    ))
    return None, issues, 0


def parse_longitude(raw: str) -> Tuple[Optional[float], List[CoordinateIssue], int]:
    """解析经度值，返回(十进制度值, 问题列表, 原始行号占位)."""
    issues = []
    raw_stripped = raw.strip()
    if not raw_stripped:
        issues.append(CoordinateIssue(
            issue_type="经度缺失",
            description="经度字段为空",
            source_line=0,
            raw_value=raw,
        ))
        return None, issues, 0

    for pattern in LON_PATTERNS:
        match = pattern.match(raw_stripped)
        if not match:
            continue
        groups = match.groups()
        try:
            num_groups = len(groups)

            if num_groups == 1:
                degrees = _safe_float(groups[0])
                minutes = 0.0
                seconds = 0.0
                hemisphere = None
            elif num_groups == 2 and groups[1] and groups[1].upper() in ('E', 'W'):
                degrees = _safe_float(groups[0])
                minutes = 0.0
                seconds = 0.0
                hemisphere = groups[1]
            elif num_groups == 4 and groups[0] and groups[0].upper() in ('E', 'W'):
                hemisphere = groups[0]
                degrees = _safe_float(groups[1])
                minutes = _safe_float(groups[2])
                seconds = _safe_float(groups[3])
            else:
                degrees = _safe_float(groups[0])
                minutes = _safe_float(groups[1]) if num_groups > 1 else 0.0
                seconds = _safe_float(groups[2]) if num_groups > 2 else 0.0
                hemisphere = groups[3] if num_groups > 3 and groups[3] else None

            value = _dms_to_decimal(degrees, minutes, seconds, hemisphere)

            if abs(value) > 180:
                issues.append(CoordinateIssue(
                    issue_type="经度越界",
                    description=f"经度值 {value} 超出 -180~180 范围",
                    source_line=0,
                    raw_value=raw,
                ))
            return value, issues, 0
        except (ValueError, IndexError):
            continue

    issues.append(CoordinateIssue(
        issue_type="经度格式无法识别",
        description=f"无法解析经度: {raw_stripped}",
        source_line=0,
        raw_value=raw,
    ))
    return None, issues, 0


def detect_lat_lon_reversed(lat_value: Optional[float],
                            lon_value: Optional[float],
                            raw_lat: str,
                            raw_lon: str) -> Tuple[bool, List[CoordinateIssue]]:
    """检测经纬度是否写反.

    判断逻辑:
    1. 纬度绝对值 > 90 且 经度绝对值 <= 90 → 疑似反写
    2. 原始文本中纬度带 E/W 标识 或 经度带 N/S 标识 → 疑似反写
    """
    issues = []
    reversed_flag = False

    raw_lat_upper = raw_lat.strip().upper()
    raw_lon_upper = raw_lon.strip().upper()

    if lat_value is not None and lon_value is not None:
        if abs(lat_value) > 90 >= abs(lon_value):
            reversed_flag = True
            issues.append(CoordinateIssue(
                issue_type="经纬度反写",
                description=f"纬度值 {lat_value} 超出正常范围，经度值 {lon_value} 在纬度范围内，疑似经纬度写反",
                source_line=0,
                raw_value=f"lat={raw_lat}, lon={raw_lon}",
            ))

    has_ew_in_lat = any(h in raw_lat_upper for h in ('E', 'W'))
    has_ns_in_lat = any(h in raw_lat_upper for h in ('N', 'S'))
    has_ew_in_lon = any(h in raw_lon_upper for h in ('E', 'W'))
    has_ns_in_lon = any(h in raw_lon_upper for h in ('N', 'S'))

    if has_ew_in_lat and not has_ns_in_lat:
        reversed_flag = True
        issues.append(CoordinateIssue(
            issue_type="经纬度反写(标识)",
            description=f"纬度字段包含 E/W 标识: {raw_lat}",
            source_line=0,
            raw_value=raw_lat,
        ))

    if has_ns_in_lon and not has_ew_in_lon:
        reversed_flag = True
        issues.append(CoordinateIssue(
            issue_type="经纬度反写(标识)",
            description=f"经度字段包含 N/S 标识: {raw_lon}",
            source_line=0,
            raw_value=raw_lon,
        ))

    return reversed_flag, issues
