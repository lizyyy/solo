from __future__ import annotations

import re
from datetime import datetime
from typing import List, Dict, Any, Optional

from models import (
    RawBuoyLog, BuoyRecord, TideStationAnnotation, AnnotationStatus,
    generate_id
)
from coordinate_parser import parse_coordinates
from tide_normalizer import normalize_tide, tide_to_original_string


LOG_PATTERNS = [
    re.compile(
        r'^(?P<timestamp>[\d\- :T]+)\s+'
        r'(?P<lat>[NSns\-+\d\s°\'′"″.,]+?)\s*[,/\s]\s*'
        r'(?P<lng>[EWew\-+\d\s°\'′"″.,]+?)\s+'
        r'(?P<station>[\u4e00-\u9fa5A-Za-z0-9_\-]+站?)\s+'
        r'潮位[：:]\s*(?P<tide_val>-?\d+\.?\d*)\s*(?P<tide_unit>[a-zA-Z\u4e00-\u9fa5]*)\s*'
        r'(?P<extra>.*)$'
    ),
    re.compile(
        r'^(?P<station>[\u4e00-\u9fa5A-Za-z0-9_\-]+站?)\s+'
        r'(?P<timestamp>[\d\- :T]+)\s+'
        r'纬[：:]\s*(?P<lat>[NSns\-+\d\s°\'′"″.,]+?)\s+'
        r'经[：:]\s*(?P<lng>[EWew\-+\d\s°\'′"″.,]+?)\s+'
        r'潮[：:]\s*(?P<tide_val>-?\d+\.?\d*)\s*(?P<tide_unit>[a-zA-Z\u4e00-\u9fa5]*)\s*'
        r'(?P<extra>.*)$'
    ),
]


def _fallback_extract_fields(raw_text: str) -> Dict[str, str]:
    tokens = raw_text.strip().split()
    result: Dict[str, str] = {
        "timestamp": "",
        "lat": "",
        "lng": "",
        "tide_val": "",
        "tide_unit": "",
    }

    for tok in tokens:
        if re.match(r'^\d{4}[-:]\d{2}', tok):
            if not result["timestamp"]:
                result["timestamp"] = tok
            else:
                result["timestamp"] = result["timestamp"] + " " + tok
        elif re.search(r'[NnSs]$', tok) or re.match(r'^[-+]?\d+\.?\d*$', tok) and not result["lat"]:
            if not result["lat"]:
                result["lat"] = tok
            elif not result["lng"]:
                result["lng"] = tok
        elif re.search(r'[EeWw]$', tok):
            if not result["lng"]:
                result["lng"] = tok
        elif re.search(r'潮位[：:]', tok):
            pass

    tide_match = re.search(r'潮位[：:]\s*(-?\d+\.?\d*)\s*([a-zA-Z\u4e00-\u9fa5]*)', raw_text)
    if tide_match:
        result["tide_val"] = tide_match.group(1)
        result["tide_unit"] = tide_match.group(2)

    coord_match = re.search(
        r'([NSns\-+\d\s°\'′"″.,]+?)\s*[,/\s]\s*([EWew\-+\d\s°\'′"″.,/]+)',
        raw_text
    )
    if coord_match:
        result["lat"] = coord_match.group(1).strip() or result["lat"]
        result["lng"] = coord_match.group(2).strip() or result["lng"]

    return result


def parse_buoy_log_line(raw_text: str, source_file: str, line_number: int) -> RawBuoyLog:
    for pattern in LOG_PATTERNS:
        m = pattern.match(raw_text.strip())
        if m:
            gd = m.groupdict()
            warnings: List[str] = []
            extra = gd.get('extra', '').strip()
            if extra:
                warnings.append(f"附加内容未解析: {extra}")
            return RawBuoyLog(
                log_id=generate_id('log'),
                raw_text=raw_text,
                raw_latitude=gd.get('lat', '').strip(),
                raw_longitude=gd.get('lng', '').strip(),
                raw_tide_value=gd.get('tide_val', '').strip(),
                raw_tide_unit=gd.get('tide_unit', '').strip(),
                timestamp=gd.get('timestamp', '').strip(),
                source_file=source_file,
                line_number=line_number,
                parse_warnings=warnings
            )

    fallback = _fallback_extract_fields(raw_text)
    warnings = ["日志行格式不匹配任何已知模式，使用备用提取"]
    if not fallback["lat"] or not fallback["lng"]:
        warnings.append("备用提取未能定位完整经纬度，原始文本已保留")
    return RawBuoyLog(
        log_id=generate_id('log'),
        raw_text=raw_text,
        raw_latitude=fallback["lat"],
        raw_longitude=fallback["lng"],
        raw_tide_value=fallback["tide_val"],
        raw_tide_unit=fallback["tide_unit"],
        timestamp=fallback["timestamp"],
        source_file=source_file,
        line_number=line_number,
        parse_warnings=warnings
    )


def build_buoy_record(raw_log: RawBuoyLog) -> BuoyRecord:
    errors: List[str] = []
    is_valid = True

    coords = None
    try:
        coords = parse_coordinates(raw_log.raw_latitude, raw_log.raw_longitude)
        if coords and "无法解析" in " ".join(coords.parse_notes):
            is_valid = False
            errors.append(f"坐标解析失败: {'; '.join(coords.parse_notes)}")
    except Exception as e:
        errors.append(f"坐标解析异常: {str(e)}")
        is_valid = False

    tide = None
    try:
        tide = normalize_tide(raw_log.raw_tide_value, raw_log.raw_tide_unit)
        if tide and tide.original_unit.value == "unknown" and not raw_log.raw_tide_value:
            is_valid = False
            errors.append("潮位值缺失，无法解析")
    except Exception as e:
        errors.append(f"潮位解析异常: {str(e)}")
        is_valid = False

    if raw_log.parse_warnings:
        for w in raw_log.parse_warnings:
            errors.append(f"[原始日志警告] {w}")
            if "格式不匹配" in w or "未能定位完整经纬度" in w:
                is_valid = False

    return BuoyRecord(
        record_id=generate_id('rec'),
        raw_log=raw_log,
        coordinates=coords,
        tide=tide,
        parse_errors=errors,
        is_valid=is_valid
    )


def _assess_tide_level(value_m: float) -> str:
    if value_m >= 3.5:
        return "超高潮"
    elif value_m >= 2.5:
        return "高潮位"
    elif value_m >= 1.0:
        return "中潮位"
    elif value_m >= 0.0:
        return "低潮位"
    else:
        return "负潮位"


def _unified_data_source(record: BuoyRecord, remarks: List[str]) -> Dict[str, Any]:
    raw = record.raw_log
    coords = record.coordinates
    tide = record.tide

    lat_str = f"{coords.latitude:.6f}" if coords else "N/A"
    lng_str = f"{coords.longitude:.6f}" if coords else "N/A"
    coord_fmt = coords.original_format.value if coords else "unknown"

    latitude_original = coords.raw_latitude if (coords and coords.raw_latitude) else raw.raw_latitude
    longitude_original = coords.raw_longitude if (coords and coords.raw_longitude) else raw.raw_longitude

    tide_m_str = f"{tide.value_meters:.4f}" if tide else "N/A"
    tide_original = tide_to_original_string(tide) if tide else (
        f"{raw.raw_tide_value} {raw.raw_tide_unit}".strip() or "N/A"
    )
    tide_level = _assess_tide_level(tide.value_meters) if tide else "未知"

    station_name = raw.raw_text.split()[2] if len(raw.raw_text.split()) >= 3 else "未知站"
    station_match = re.search(r'([\u4e00-\u9fa5A-Za-z0-9_\-]+站)', raw.raw_text)
    if station_match:
        station_name = station_match.group(1)

    issues: List[str] = []
    if not record.is_valid:
        issues.append("记录存在解析错误")
    if coords and coords.parse_notes:
        issues.extend(coords.parse_notes)
    if tide and tide.normalize_notes:
        issues.extend(tide.normalize_notes)
    if record.parse_errors:
        issues.extend(record.parse_errors)

    remark_text = "；".join(remarks) if remarks else "无"

    return {
        "station_name": station_name,
        "timestamp": raw.timestamp or "未知时间",
        "latitude_decimal": lat_str,
        "longitude_decimal": lng_str,
        "latitude_original": latitude_original,
        "longitude_original": longitude_original,
        "coordinate_format": coord_fmt,
        "tide_meters": tide_m_str,
        "tide_original": tide_original,
        "tide_level": tide_level,
        "tide_unit_raw": tide.original_unit_raw if tide else raw.raw_tide_unit,
        "issues": issues,
        "remarks": remark_text,
        "raw_text": raw.raw_text,
        "source_ref": f"{raw.source_file}:{raw.line_number}",
        "record_id": record.record_id,
        "log_id": raw.log_id,
    }


def build_scene_annotation(data: Dict[str, Any]) -> str:
    has_error = any("解析错误" in i or "解析失败" in i or "EXCEPTION" in i for i in data['issues'])
    parts = [
        f"【{data['station_name']}】潮汐能站空间标注",
    ]
    if has_error:
        parts.append(f"[异常] 原始浮标日志: {data['raw_text']}")
    parts.extend([
        f"时间: {data['timestamp']}",
        f"位置: ({data['latitude_decimal']}°N, {data['longitude_decimal']}°E)",
        f"原始坐标: {data['latitude_original']}, {data['longitude_original']} (格式: {data['coordinate_format']})",
        f"潮位: {data['tide_meters']} m（原始: {data['tide_original']}），判定为【{data['tide_level']}】",
    ])
    if data['remarks'] and data['remarks'] != "无":
        parts.append(f"备注: {data['remarks']}")
    if data['issues']:
        parts.append(f"线索提示: {'；'.join(data['issues'][:3])}")
    return " | ".join(parts)


def build_side_note(data: Dict[str, Any]) -> str:
    lines = [
        f"站点名: {data['station_name']}",
        f"记录时间: {data['timestamp']}",
        f"标准化坐标: {data['latitude_decimal']}, {data['longitude_decimal']}",
        f"原始坐标写法: {data['latitude_original']} / {data['longitude_original']}",
        f"坐标原始格式: {data['coordinate_format']}",
        f"标准化潮位: {data['tide_meters']} m",
        f"原始潮位写法: {data['tide_original']}",
        f"潮位等级判定: {data['tide_level']}",
        f"浮标日志来源: {data['source_ref']}",
        f"原始浮标日志全文: {data['raw_text']}",
    ]
    if data['remarks'] and data['remarks'] != "无":
        lines.append(f"人工备注: {data['remarks']}")
    if data['issues']:
        lines.append("---")
        lines.append("解析与判定线索:")
        for i, issue in enumerate(data['issues'], 1):
            lines.append(f"  {i}. {issue}")
    return "\n".join(lines)


def build_csv_row(data: Dict[str, Any]) -> Dict[str, str]:
    return {
        "station_name": data['station_name'],
        "timestamp": data['timestamp'],
        "latitude": data['latitude_decimal'],
        "longitude": data['longitude_decimal'],
        "latitude_raw": data['latitude_original'],
        "longitude_raw": data['longitude_original'],
        "coordinate_format": data['coordinate_format'],
        "tide_meters": data['tide_meters'],
        "tide_original": data['tide_original'],
        "tide_unit_raw": data['tide_unit_raw'],
        "tide_level": data['tide_level'],
        "remarks": data['remarks'],
        "issues": " | ".join(data['issues']),
        "raw_text": data['raw_text'],
        "source_ref": data['source_ref'],
        "record_id": data['record_id'],
        "log_id": data['log_id'],
    }


CSV_HEADERS = [
    "station_name", "timestamp",
    "latitude", "longitude",
    "latitude_raw", "longitude_raw", "coordinate_format",
    "tide_meters", "tide_original", "tide_unit_raw", "tide_level",
    "remarks", "issues",
    "raw_text", "source_ref", "record_id", "log_id"
]


def create_annotation(batch_id: str, record: BuoyRecord,
                      remarks: Optional[List[str]] = None,
                      status: Optional[AnnotationStatus] = None
                      ) -> TideStationAnnotation:
    remarks_list = remarks or []
    unified = _unified_data_source(record, remarks_list)

    if status is None:
        status = AnnotationStatus.EXCEPTION if not record.is_valid else AnnotationStatus.PROCESSED

    annotation = TideStationAnnotation(
        annotation_id=generate_id('ann'),
        batch_id=batch_id,
        station_name=unified["station_name"],
        buoy_record=record,
        scene_annotation=build_scene_annotation(unified),
        side_note=build_side_note(unified),
        csv_row=build_csv_row(unified),
        status=status,
        remarks=remarks_list,
        raw_trace={
            "unified_source_snapshot": unified,
            "parse_timestamp": datetime.now().isoformat(),
        }
    )
    return annotation
