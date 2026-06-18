import re
from typing import Tuple, Optional

from app.models import CoordinateFormat


class CoordinateNormalizationError(Exception):
    pass


def detect_format(value: str) -> CoordinateFormat:
    if value is None:
        return CoordinateFormat.UNKNOWN
    value = str(value).strip()
    if not value:
        return CoordinateFormat.UNKNOWN

    if re.search(r"[°'\"′″]", value):
        return CoordinateFormat.DMS

    try:
        float_val = float(value)
        if -180 <= float_val <= 180:
            return CoordinateFormat.DECIMAL
    except (ValueError, TypeError):
        pass

    return CoordinateFormat.UNKNOWN


def dms_to_decimal(dms_str: str) -> float:
    dms_str = str(dms_str).strip()
    dms_str = dms_str.replace("′", "'").replace("″", '"').replace(" ", "")

    sign = 1
    if dms_str.startswith("-"):
        sign = -1
        dms_str = dms_str[1:]
    elif dms_str[-1] in ("S", "W", "s", "w"):
        sign = -1
        dms_str = dms_str[:-1]
    elif dms_str[-1] in ("N", "E", "n", "e"):
        dms_str = dms_str[:-1]

    pattern = r"(\d+(?:\.\d+)?)[°](?:(\d+(?:\.\d+)?)['](?:(\d+(?:\.\d+)?)[\"]?)?)?"
    match = re.match(pattern, dms_str)
    if not match:
        raise CoordinateNormalizationError(f"无法解析 DMS 格式: {dms_str}")

    degrees = float(match.group(1))
    minutes = float(match.group(2)) if match.group(2) else 0.0
    seconds = float(match.group(3)) if match.group(3) else 0.0

    if minutes < 0 or minutes >= 60:
        raise CoordinateNormalizationError(f"分超出有效范围 [0, 60): {minutes}")
    if seconds < 0 or seconds >= 60:
        raise CoordinateNormalizationError(f"秒超出有效范围 [0, 60): {seconds}")

    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    return sign * decimal


def decimal_to_decimal(value: str) -> float:
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        raise CoordinateNormalizationError(f"无法解析十进制格式: {value}")


def normalize_coordinate(raw_value: str) -> Tuple[float, CoordinateFormat]:
    if raw_value is None:
        raise CoordinateNormalizationError("坐标值为空")
    fmt = detect_format(raw_value)
    if fmt == CoordinateFormat.DECIMAL:
        return decimal_to_decimal(raw_value), fmt
    elif fmt == CoordinateFormat.DMS:
        return dms_to_decimal(raw_value), fmt
    else:
        raise CoordinateNormalizationError(f"无法识别的坐标格式: {raw_value}")


def validate_latitude(lat: float) -> bool:
    return -90 <= lat <= 90


def validate_longitude(lon: float) -> bool:
    return -180 <= lon <= 180


def normalize_pair(raw_lat: str, raw_lon: str) -> Tuple[Optional[float], Optional[float], CoordinateFormat, CoordinateFormat, str]:
    errors = []
    lat_val = None
    lon_val = None
    lat_fmt = CoordinateFormat.UNKNOWN
    lon_fmt = CoordinateFormat.UNKNOWN

    try:
        lat_val, lat_fmt = normalize_coordinate(raw_lat)
        if not validate_latitude(lat_val):
            errors.append(f"纬度超出有效范围 [-90, 90]: {lat_val}")
            lat_val = None
    except CoordinateNormalizationError as e:
        errors.append(f"纬度: {str(e)}")

    try:
        lon_val, lon_fmt = normalize_coordinate(raw_lon)
        if not validate_longitude(lon_val):
            errors.append(f"经度超出有效范围 [-180, 180]: {lon_val}")
            lon_val = None
    except CoordinateNormalizationError as e:
        errors.append(f"经度: {str(e)}")

    return lat_val, lon_val, lat_fmt, lon_fmt, "; ".join(errors)
