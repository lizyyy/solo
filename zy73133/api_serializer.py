from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Dict, Any, List, Tuple

from models import (
    TideStationAnnotation, AnnotationStatus, BatchProcessResult,
    AnnotationVersion, RemarkDelta
)


def _is_coord_parse_failed(notes: List[str]) -> bool:
    keywords = ("无法解析", "原始值为空", "超出有效范围")
    return any(any(k in n for k in keywords) for n in notes)


def _is_tide_hard_failed(notes: List[str]) -> bool:
    keywords = ("无法提取数值", "数值解析失败", "单位未识别，保留原始数值")
    return any(any(k in n for k in keywords) for n in notes)


def _has_tide_fallback_warning(notes: List[str]) -> bool:
    return any("按米处理（需人工复核）" in n for n in notes)


def _coord_value_out_of_range(coords) -> bool:
    if coords is None:
        return False
    if not (-90 <= coords.latitude <= 90):
        return True
    if not (-180 <= coords.longitude <= 180):
        return True
    return False


def _determine_status_and_reasons(ann: TideStationAnnotation) -> Tuple[str, List[str], List[str]]:
    reasons: List[str] = []
    impacts: List[str] = []
    coords = ann.buoy_record.coordinates
    tide = ann.buoy_record.tide
    raw = ann.buoy_record.raw_log

    coord_invalid = False
    if coords is None:
        coord_invalid = True
        reasons.append("坐标对象为 None，解析过程异常")
        impacts.append("站点空间位置缺失，无法在地图上标注")
    elif _is_coord_parse_failed(coords.parse_notes) or _coord_value_out_of_range(coords):
        coord_invalid = True
        reasons.extend(coords.parse_notes if coords else [])
        impacts.append("坐标解析失败或部分缺失，三维点位可能不可靠")
    elif not (raw.raw_latitude and raw.raw_longitude):
        coord_invalid = True
        reasons.append("原始经纬度片段缺失")
        impacts.append("坐标解析失败或部分缺失，三维点位可能不可靠")

    tide_invalid = False
    if tide is None:
        tide_invalid = True
        reasons.append("潮位对象为 None")
        impacts.append("潮位数据缺失，无法评估潮汐能等级")
    elif not raw.raw_tide_value:
        tide_invalid = True
        reasons.append("原始潮位值缺失")
        impacts.append("潮位数据缺失，无法评估潮汐能等级")
    elif _is_tide_hard_failed(tide.normalize_notes):
        tide_invalid = True
        reasons.extend(tide.normalize_notes)
        impacts.append("潮位单位未识别，数值可信度存疑，需人工复核")
    elif _has_tide_fallback_warning(tide.normalize_notes) and not raw.raw_tide_value:
        tide_invalid = True
        reasons.extend(tide.normalize_notes)
        reasons.append("按米处理警告且原始值为空，潮位不可信")
        impacts.append("潮位单位未识别，数值可信度存疑，需人工复核")

    if ann.status == AnnotationStatus.EXCEPTION:
        reasons.append("日志行格式不匹配已知模式")
        impacts.append("整条日志处于异常状态，全部判断需人工核查")

    pending = False
    if coords and coords.parse_notes and not coord_invalid:
        pending = True
        reasons.extend(coords.parse_notes)
        impacts.append("坐标存在格式不一致或符号判定等解析线索，建议复核")
    if tide and tide.normalize_notes and not tide_invalid:
        pending = True
        reasons.extend(tide.normalize_notes)
        impacts.append("潮位经过单位换算或格式修正，建议复核换算过程")
    if ann.buoy_record.parse_errors and not (coord_invalid or tide_invalid or ann.status == AnnotationStatus.EXCEPTION):
        pending = True
        reasons.extend(ann.buoy_record.parse_errors)

    if coord_invalid or tide_invalid or ann.status == AnnotationStatus.EXCEPTION:
        status = "exception"
        if not impacts:
            impacts.append("解析异常，所有空间和能位判断均不可靠")
    elif pending:
        status = "pending"
    else:
        status = "normal"

    return status, reasons, impacts


def annotation_to_station_record(ann: TideStationAnnotation) -> Dict[str, Any]:
    status, reasons, impacts = _determine_status_and_reasons(ann)
    coords = ann.buoy_record.coordinates
    tide = ann.buoy_record.tide
    raw = ann.buoy_record.raw_log

    coord_ok = (
        coords is not None
        and not _is_coord_parse_failed(coords.parse_notes)
        and not _coord_value_out_of_range(coords)
        and bool(raw.raw_latitude and raw.raw_longitude)
    )

    latitude = None
    longitude = None
    if coord_ok:
        latitude = round(coords.latitude, 6)
        longitude = round(coords.longitude, 6)

    tide_ok = (
        tide is not None
        and bool(raw.raw_tide_value)
        and not _is_tide_hard_failed(tide.normalize_notes)
        and not (_has_tide_fallback_warning(tide.normalize_notes) and not raw.raw_tide_value)
    )

    tide_meters = None
    tide_level = ann.csv_row.get("tide_level", "未知")
    if tide_ok:
        tide_meters = round(tide.value_meters, 6)
    if tide_level in ("未知", "") and tide_meters is not None:
        if tide_meters >= 3.5:
            tide_level = "超高潮"
        elif tide_meters >= 2.5:
            tide_level = "高潮位"
        elif tide_meters >= 1.0:
            tide_level = "中潮位"
        elif tide_meters >= 0.0:
            tide_level = "低潮位"
        else:
            tide_level = "负潮位"

    return {
        "log_id": raw.log_id,
        "record_id": ann.buoy_record.record_id,
        "annotation_id": ann.annotation_id,
        "station_name": ann.station_name,

        "latitude": latitude,
        "longitude": longitude,
        "latitude_raw": raw.raw_latitude,
        "longitude_raw": raw.raw_longitude,
        "coordinate_format": coords.original_format.value if coords else "unknown",
        "parse_notes": coords.parse_notes if coords else ["坐标解析对象缺失"],

        "tide_meters": tide_meters,
        "tide_original": ann.csv_row.get("tide_original", ""),
        "tide_unit_raw": ann.csv_row.get("tide_unit_raw", raw.raw_tide_unit),
        "tide_level": tide_level,
        "tide_normalize_notes": tide.normalize_notes if tide else ["潮位解析对象缺失"],

        "status": status,
        "status_reasons": reasons,
        "judgment_impact": impacts,

        "scene_annotation": ann.scene_annotation,
        "side_note": ann.side_note,
        "csv_row": ann.csv_row,

        "raw_text": raw.raw_text,
        "source_ref": f"{raw.source_file}:{raw.line_number}",
        "timestamp": raw.timestamp or "未知时间",
        "remarks": list(ann.remarks),
        "has_exception": status == "exception",
    }


def delta_to_report(v: AnnotationVersion) -> Dict[str, Any]:
    return {
        "version_id": v.version_id,
        "annotation_id": v.annotation_id,
        "version_number": v.version_number,
        "applied_remark": v.applied_remark or "",
        "created_at": v.created_at.isoformat() if isinstance(v.created_at, datetime) else str(v.created_at),
        "deltas": [
            {
                "field_changed": d.field_changed,
                "old_value": d.old_value,
                "new_value": d.new_value,
                "judgment_impact": d.judgment_impact,
            }
            for d in v.deltas
        ],
    }


def batch_to_api_response(batch: BatchProcessResult) -> Dict[str, Any]:
    stations = [annotation_to_station_record(a) for a in batch.annotations]

    counts = {"total": len(stations), "normal": 0, "pending": 0, "exception": 0}
    for s in stations:
        counts[s["status"]] = counts.get(s["status"], 0) + 1

    export_map: Dict[str, str] = {}
    for e in batch.exports:
        export_map[e.export_type] = e.export_path

    deltas = [delta_to_report(v) for v in batch.versions if v.version_number == 2 and v.deltas]

    same_count = len([s for s in stations if not any(
        d["annotation_id"] == s["annotation_id"] for d in deltas
    )])
    changed_count = len(deltas)
    still_pending = len([s for s in stations if s["status"] == "pending"])

    return {
        "batch_id": batch.batch_id,
        "stations": stations,
        "deltas": deltas,
        "exports": export_map,
        "stats": {
            **counts,
            "same_count": same_count,
            "changed_count": changed_count,
            "still_pending": still_pending,
        },
        "processed_at": batch.processed_at.isoformat(),
        "has_exceptions": batch.has_exceptions,
        "source_files": batch.source_files,
    }
