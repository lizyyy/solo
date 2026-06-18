import re
import math
from typing import Optional, Tuple, List
from .models import (
    RawSampleRecord,
    CleanedRecord,
    CleanAnomaly,
    AnomalyType,
    FailReason,
)


def parse_lat_lon(raw: str, is_lat: bool) -> Tuple[Optional[float], Optional[CleanAnomaly]]:
    if not raw or not raw.strip():
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.MISSING_VALUE,
            field_name="latitude" if is_lat else "longitude",
            message="经纬度值缺失",
            fail_reason=FailReason.FORMAT,
        )

    raw = raw.strip()
    decimal_value: Optional[float] = None
    direction_char = ""

    simple_patterns = [
        r"^(-?\d+\.?\d*)°?\s*([NSEWnsew])\s*$",
        r"^([NSEWnsew])\s*(-?\d+\.?\d*)°?\s*$",
        r"^(-?\d+\.?\d*)\s*$",
    ]

    for pat in simple_patterns:
        m = re.match(pat, raw)
        if m:
            groups = m.groups()
            if len(groups) == 2:
                g1, g2 = groups
                if g1.upper() in "NSEW":
                    direction_char = g1.upper()
                    num_str = g2
                else:
                    num_str = g1
                    direction_char = g2.upper()
                try:
                    decimal_value = float(num_str)
                except ValueError:
                    continue
                break
            elif len(groups) == 1:
                try:
                    decimal_value = float(groups[0])
                    direction_char = ""
                except ValueError:
                    continue
                break

    if decimal_value is None:
        dms_patterns = [
            r"^(\d+)°\s*(\d+)'?\s*(\d+\.?\d*)\"?\s*([NSEWnsew]?)\s*$",
            r"^(\d+)\s+(\d+)\s+(\d+\.?\d*)\s*([NSEWnsew]?)\s*$",
            r"^([NSEWnsew])\s*(\d+)°\s*(\d+)'?\s*(\d+\.?\d*)\"?\s*$",
        ]
        for pat in dms_patterns:
            m = re.match(pat, raw)
            if m:
                groups = m.groups()
                if len(groups) == 4:
                    if groups[0].upper() in "NSEW":
                        direction_char = groups[0].upper()
                        deg, minutes, seconds = groups[1], groups[2], groups[3]
                    else:
                        deg, minutes, seconds, direction_char = groups
                        direction_char = direction_char.upper()
                    try:
                        decimal_value = int(deg) + int(minutes) / 60.0 + float(seconds) / 3600.0
                    except ValueError:
                        continue
                    break
                elif len(groups) == 3 and "°" in raw and "'" in raw:
                    dm_patterns2 = [
                        r"^(\d+)°\s*(\d+\.?\d*)'\s*([NSEWnsew]?)\s*$",
                        r"^([NSEWnsew])\s*(\d+)°\s*(\d+\.?\d*)'\s*$",
                    ]
                    for pat2 in dm_patterns2:
                        m2 = re.match(pat2, raw)
                        if m2:
                            g = m2.groups()
                            if g[0].upper() in "NSEW":
                                direction_char = g[0].upper()
                                deg, minutes = g[1], g[2]
                            else:
                                deg, minutes, direction_char = g
                                direction_char = direction_char.upper()
                            try:
                                decimal_value = int(deg) + float(minutes) / 60.0
                            except ValueError:
                                continue
                            break
                    if decimal_value is not None:
                        break

    if decimal_value is None:
        try:
            decimal_value = float(raw)
        except ValueError:
            return None, CleanAnomaly(
                anomaly_type=AnomalyType.LAT_LON_FORMAT,
                field_name="latitude" if is_lat else "longitude",
                message=f"无法解析的经纬度格式: {raw}",
                detail={"raw_value": raw},
                fail_reason=FailReason.FORMAT,
            )

    if direction_char.upper() in ('S', 'W'):
        decimal_value = -abs(decimal_value)

    if is_lat:
        if decimal_value < -90 or decimal_value > 90:
            return None, CleanAnomaly(
                anomaly_type=AnomalyType.THRESHOLD_OUTLIER,
                field_name="latitude",
                message=f"纬度超出范围: {decimal_value}",
                detail={"value": decimal_value, "min": -90, "max": 90},
                fail_reason=FailReason.THRESHOLD,
            )
    else:
        if decimal_value < -180 or decimal_value > 180:
            return None, CleanAnomaly(
                anomaly_type=AnomalyType.THRESHOLD_OUTLIER,
                field_name="longitude",
                message=f"经度超出范围: {decimal_value}",
                detail={"value": decimal_value, "min": -180, "max": 180},
                fail_reason=FailReason.THRESHOLD,
            )

    return round(decimal_value, 6), None


def convert_temperature(value: float, unit: str) -> Tuple[Optional[float], Optional[CleanAnomaly]]:
    unit = unit.strip().lower() if unit else "c"
    try:
        val = float(value)
    except (TypeError, ValueError):
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.INVALID_VALUE,
            field_name="temperature",
            message=f"温度值无效: {value}",
            fail_reason=FailReason.FORMAT,
        )

    if unit in ("c", "°c", "celsius", "摄氏度"):
        result = val
    elif unit in ("f", "°f", "fahrenheit", "华氏度"):
        result = (val - 32) * 5 / 9
    elif unit in ("k", "kelvin", "开尔文"):
        result = val - 273.15
    else:
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.UNIT_MISMATCH,
            field_name="temperature",
            message=f"未知温度单位: {unit}",
            detail={"unit": unit},
            fail_reason=FailReason.UNIT,
        )

    if result < -2 or result > 40:
        return result, CleanAnomaly(
            anomaly_type=AnomalyType.THRESHOLD_OUTLIER,
            field_name="temperature",
            message=f"温度值异常: {result}°C (超出深海正常范围 -2~40°C)",
            detail={"value_c": result, "min": -2, "max": 40},
            fail_reason=FailReason.THRESHOLD,
        )

    return round(result, 3), None


def convert_salinity(value: float, unit: str) -> Tuple[Optional[float], Optional[CleanAnomaly]]:
    unit = unit.strip().lower() if unit else "psu"
    try:
        val = float(value)
    except (TypeError, ValueError):
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.INVALID_VALUE,
            field_name="salinity",
            message=f"盐度值无效: {value}",
            fail_reason=FailReason.FORMAT,
        )

    if unit in ("psu", "‰", "ppt", "千分比"):
        result = val
    elif unit in ("%", "percent", "百分比"):
        result = val * 10
    else:
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.UNIT_MISMATCH,
            field_name="salinity",
            message=f"未知盐度单位: {unit}",
            detail={"unit": unit},
            fail_reason=FailReason.UNIT,
        )

    if result < 0 or result > 42:
        return result, CleanAnomaly(
            anomaly_type=AnomalyType.THRESHOLD_OUTLIER,
            field_name="salinity",
            message=f"盐度值异常: {result} PSU (超出正常范围 0~42 PSU)",
            detail={"value_psu": result, "min": 0, "max": 42},
            fail_reason=FailReason.THRESHOLD,
        )

    return round(result, 3), None


def convert_depth(value: float, unit: str) -> Tuple[Optional[float], Optional[CleanAnomaly]]:
    unit = unit.strip().lower() if unit else "m"
    try:
        val = float(value)
    except (TypeError, ValueError):
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.INVALID_VALUE,
            field_name="depth",
            message=f"深度值无效: {value}",
            fail_reason=FailReason.FORMAT,
        )

    if unit in ("m", "meter", "米"):
        result = val
    elif unit in ("ft", "feet", "英尺"):
        result = val * 0.3048
    elif unit in ("km", "kilometer", "千米"):
        result = val * 1000
    else:
        return None, CleanAnomaly(
            anomaly_type=AnomalyType.UNIT_MISMATCH,
            field_name="depth",
            message=f"未知深度单位: {unit}",
            detail={"unit": unit},
            fail_reason=FailReason.UNIT,
        )

    if result < 0 or result > 11000:
        return result, CleanAnomaly(
            anomaly_type=AnomalyType.THRESHOLD_OUTLIER,
            field_name="depth",
            message=f"深度值异常: {result}m (超出正常范围 0~11000m)",
            detail={"value_m": result, "min": 0, "max": 11000},
            fail_reason=FailReason.THRESHOLD,
        )

    return round(result, 2), None


def _parse_value_with_unit(raw: str) -> Tuple[Optional[float], Optional[str]]:
    raw = raw.strip()
    m = re.match(r"^(-?\d+\.?\d*)\s*([a-zA-Z%°‰]+)$", raw)
    if m:
        try:
            val = float(m.group(1))
            unit = m.group(2)
            return val, unit
        except ValueError:
            pass
    try:
        val = float(raw)
        return val, None
    except ValueError:
        return None, None


def check_missing_fields(record: RawSampleRecord) -> List[CleanAnomaly]:
    anomalies = []
    required_fields = [
        ("bottle_id", record.bottle_id, "采样瓶编号"),
        ("station", record.station, "站位"),
    ]
    for field_name, value, label in required_fields:
        if not value or not str(value).strip():
            anomalies.append(CleanAnomaly(
                anomaly_type=AnomalyType.MISSING_VALUE,
                field_name=field_name,
                message=f"{label}缺失",
                fail_reason=FailReason.FORMAT,
            ))
    return anomalies


def clean_record(record: RawSampleRecord) -> CleanedRecord:
    anomalies: List[CleanAnomaly] = []
    anomalies.extend(check_missing_fields(record))

    lat_value, lat_anomaly = parse_lat_lon(record.latitude_raw or "", is_lat=True)
    if lat_anomaly:
        anomalies.append(lat_anomaly)

    lon_value, lon_anomaly = parse_lat_lon(record.longitude_raw or "", is_lat=False)
    if lon_anomaly:
        anomalies.append(lon_anomaly)

    temp_value, temp_anomaly = None, None
    if record.temperature is not None:
        temp_value, temp_anomaly = convert_temperature(
            record.temperature, record.temperature_unit or "°C"
        )
        if temp_anomaly:
            anomalies.append(temp_anomaly)

    sal_value, sal_anomaly = None, None
    if record.salinity is not None:
        sal_value, sal_anomaly = convert_salinity(
            record.salinity, record.salinity_unit or "PSU"
        )
        if sal_anomaly:
            anomalies.append(sal_anomaly)

    depth_value, depth_anomaly = None, None
    if record.depth_m is not None:
        depth_value, depth_anomaly = convert_depth(record.depth_m, "m")
        if depth_anomaly:
            anomalies.append(depth_anomaly)
    elif record.depth_raw:
        parsed_val, parsed_unit = _parse_value_with_unit(record.depth_raw)
        if parsed_val is not None:
            depth_value, depth_anomaly = convert_depth(parsed_val, parsed_unit or "m")
            if depth_anomaly:
                anomalies.append(depth_anomaly)
        else:
            anomalies.append(CleanAnomaly(
                anomaly_type=AnomalyType.INVALID_VALUE,
                field_name="depth",
                message=f"深度原始值无法解析: {record.depth_raw}",
                fail_reason=FailReason.FORMAT,
            ))

    is_valid = not any(
        a.anomaly_type in (
            AnomalyType.MISSING_VALUE,
            AnomalyType.INVALID_VALUE,
            AnomalyType.LAT_LON_FORMAT,
        )
        for a in anomalies
    )

    return CleanedRecord(
        record_id=record.record_id,
        station=record.station,
        bottle_id=record.bottle_id,
        depth_m=depth_value,
        temperature_c=temp_value,
        salinity_psu=sal_value,
        latitude=lat_value,
        longitude=lon_value,
        sample_time=record.sample_time,
        anomalies=anomalies,
        is_valid=is_valid,
        raw_ref=record,
    )
