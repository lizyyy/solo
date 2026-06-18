from __future__ import annotations

import csv
import hashlib
import json
import os
import traceback
from copy import deepcopy
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from models import (
    TideStationAnnotation, AnnotationVersion, RemarkDelta,
    ExportRecord, BatchProcessResult, AnnotationStatus, generate_id
)
from annotation_engine import (
    parse_buoy_log_line, build_buoy_record, create_annotation, CSV_HEADERS
)


import re as _re


def _parse_remark_corrections(remark_text: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "tide_offset_m": 0.0,
        "tide_override": None,
        "found": False,
    }

    offset_match = _re.search(r'(减去|减掉|扣除|减去|\+|\-|加|增加)\s*(-?\d+\.?\d*)\s*(m|米|公尺)', remark_text)
    if offset_match:
        op = offset_match.group(1)
        val = float(offset_match.group(2))
        if op in ('减去', '减掉', '扣除', '-'):
            result["tide_offset_m"] = -val
        else:
            result["tide_offset_m"] = val
        result["found"] = True

    override_match = _re.search(r'(实际潮位|修正为|订正为|实际为)\s*[:：]?\s*(-?\d+\.?\d*)\s*(m|米|公尺)?', remark_text)
    if override_match:
        result["tide_override"] = float(override_match.group(2))
        result["found"] = True

    return result


def _apply_corrections_to_record(record, corrections: Dict[str, Any]):
    from copy import deepcopy
    new_record = deepcopy(record)
    if new_record.tide is None:
        return new_record

    if corrections.get("tide_override") is not None:
        old_val = new_record.tide.value_meters
        new_val = corrections["tide_override"]
        new_record.tide.value_meters = round(new_val, 6)
        new_record.tide.normalize_notes.append(
            f"[备注修正] 人工订正潮位由 {old_val:.4f}m 改为 {new_val:.4f}m"
        )
    elif corrections.get("tide_offset_m", 0) != 0:
        offset = corrections["tide_offset_m"]
        old_val = new_record.tide.value_meters
        new_val = round(old_val + offset, 6)
        new_record.tide.value_meters = new_val
        sign = "+" if offset >= 0 else ""
        new_record.tide.normalize_notes.append(
            f"[备注修正] 潮位人工修正: {old_val:.4f}m {sign}{offset:.4f}m = {new_val:.4f}m"
        )
    return new_record


def _compare_annotations(old: TideStationAnnotation, new: TideStationAnnotation) -> List[RemarkDelta]:
    deltas: List[RemarkDelta] = []

    fields_to_compare = [
        ("scene_annotation", "场景标注文本"),
        ("side_note", "侧边说明文本"),
        ("status", "状态"),
    ]

    for field, label in fields_to_compare:
        old_val = getattr(old, field)
        new_val = getattr(new, field)
        if old_val != new_val:
            deltas.append(RemarkDelta(
                field_changed=label,
                old_value=old_val,
                new_value=new_val,
                judgment_impact=f"{label}发生变更，影响输出一致性"
            ))

    old_row = old.csv_row
    new_row = new.csv_row
    csv_fields = [
        ("tide_level", "潮位等级判断"),
        ("tide_meters", "标准化潮位值"),
        ("remarks", "备注内容"),
        ("issues", "解析问题线索"),
    ]
    for field, label in csv_fields:
        if old_row.get(field) != new_row.get(field):
            if field == "tide_level":
                impact = f"潮位等级由【{old_row.get(field)}】变更为【{new_row.get(field)}】，影响站点可开发性判断"
            elif field == "remarks":
                impact = "新增/修改人工备注，影响判断依据，需重新评估"
            elif field == "tide_meters":
                impact = f"标准化潮位值由 {old_row.get(field)} m 变更为 {new_row.get(field)} m，影响潮位等级与能位判断"
            else:
                impact = f"{label}发生变更，影响问题追溯"
            deltas.append(RemarkDelta(
                field_changed=label,
                old_value=old_row.get(field, ""),
                new_value=new_row.get(field, ""),
                judgment_impact=impact
            ))

    return deltas


def apply_remark_and_version(
    annotation: TideStationAnnotation,
    remark_text: str,
    version_number: int
) -> Tuple[TideStationAnnotation, AnnotationVersion]:
    new_remarks = annotation.remarks + [remark_text]
    old_annotation = deepcopy(annotation)

    corrections = _parse_remark_corrections(remark_text)
    effective_record = annotation.buoy_record
    if corrections["found"]:
        effective_record = _apply_corrections_to_record(annotation.buoy_record, corrections)

    new_annotation = create_annotation(
        batch_id=annotation.batch_id,
        record=effective_record,
        remarks=new_remarks,
        status=AnnotationStatus.REPROCESSED
    )
    new_annotation.annotation_id = annotation.annotation_id
    new_annotation.created_at = annotation.created_at
    new_annotation.updated_at = datetime.now()
    new_annotation.raw_trace["remark_applied"] = remark_text
    new_annotation.raw_trace["remark_time"] = datetime.now().isoformat()
    new_annotation.raw_trace["previous_version_annotation_id"] = annotation.annotation_id
    if corrections["found"]:
        new_annotation.raw_trace["remark_corrections"] = corrections

    deltas = _compare_annotations(old_annotation, new_annotation)

    version = AnnotationVersion(
        version_id=generate_id('ver'),
        batch_id=annotation.batch_id,
        annotation_id=annotation.annotation_id,
        version_number=version_number,
        annotation=deepcopy(new_annotation),
        applied_remark=remark_text,
        deltas=deltas
    )

    return new_annotation, version


def format_delta_report(version: AnnotationVersion) -> str:
    if not version.deltas:
        return f"版本 {version.version_number}：备注未改变任何判断结果\n备注内容: {version.applied_remark}"

    lines = [
        f"=== 版本 {version.version_number} 变更报告 ===",
        f"备注内容: {version.applied_remark}",
        f"影响判断的变更 ({len(version.deltas)} 项):",
    ]
    for i, delta in enumerate(version.deltas, 1):
        lines.append(f"  {i}. {delta.field_changed}")
        lines.append(f"     旧值: {delta.old_value}")
        lines.append(f"     新值: {delta.new_value}")
        lines.append(f"     影响: {delta.judgment_impact}")
    return "\n".join(lines)


def safe_process_log_line(raw_text: str, source_file: str, line_number: int,
                          batch_id: str) -> Tuple[Optional[TideStationAnnotation], Optional[str]]:
    raw_log = None
    try:
        raw_log = parse_buoy_log_line(raw_text, source_file, line_number)
        record = build_buoy_record(raw_log)

        if not record.is_valid:
            annotation = create_annotation(
                batch_id=batch_id,
                record=record,
                status=AnnotationStatus.EXCEPTION
            )
            annotation.raw_trace["exception_context"] = {
                "raw_text": raw_text,
                "parse_errors": record.parse_errors,
                "raw_log_snapshot": {
                    "raw_latitude": raw_log.raw_latitude,
                    "raw_longitude": raw_log.raw_longitude,
                    "raw_tide_value": raw_log.raw_tide_value,
                    "raw_tide_unit": raw_log.raw_tide_unit,
                }
            }
            return annotation, None

        annotation = create_annotation(batch_id=batch_id, record=record)
        return annotation, None

    except Exception as e:
        error_trace = traceback.format_exc()
        annotation = TideStationAnnotation(
            annotation_id=generate_id('ann'),
            batch_id=batch_id,
            station_name="异常记录",
            buoy_record=record if 'record' in dir() else build_buoy_record(
                raw_log if raw_log else parse_buoy_log_line(raw_text, source_file, line_number)
            ),
            scene_annotation=f"[处理异常] {str(e)} | 原始日志: {raw_text}",
            side_note=f"处理异常: {str(e)}\n原始日志保留:\n{raw_text}\n来源: {source_file}:{line_number}\n堆栈:\n{error_trace}",
            csv_row={
                "station_name": "异常记录",
                "timestamp": "",
                "latitude": "",
                "longitude": "",
                "latitude_raw": raw_log.raw_latitude if raw_log else "",
                "longitude_raw": raw_log.raw_longitude if raw_log else "",
                "coordinate_format": "",
                "tide_meters": "",
                "tide_original": raw_log.raw_tide_value + " " + raw_log.raw_tide_unit if raw_log else "",
                "tide_unit_raw": raw_log.raw_tide_unit if raw_log else "",
                "tide_level": "",
                "remarks": "",
                "issues": f"EXCEPTION: {str(e)}; 原始线索已保留",
                "raw_text": raw_text,
                "source_ref": f"{source_file}:{line_number}",
                "record_id": "",
                "log_id": raw_log.log_id if raw_log else "",
            },
            status=AnnotationStatus.EXCEPTION,
            remarks=[f"处理异常: {str(e)}"],
            raw_trace={
                "exception": str(e),
                "traceback": error_trace,
                "raw_text": raw_text,
                "source_file": source_file,
                "line_number": line_number,
            }
        )
        return annotation, error_trace


def process_buoy_file(file_path: str, batch_id: str) -> List[TideStationAnnotation]:
    annotations: List[TideStationAnnotation] = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            ann, _ = safe_process_log_line(stripped, file_path, line_num, batch_id)
            if ann:
                annotations.append(ann)
    return annotations


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def export_scene_annotations(annotations: List[TideStationAnnotation],
                             output_path: str, batch_id: str,
                             version_id: str) -> ExportRecord:
    lines = [ann.scene_annotation for ann in annotations]
    content = "\n".join(lines) + "\n"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return ExportRecord(
        export_id=generate_id('exp'),
        batch_id=batch_id,
        version_id=version_id,
        export_type="scene_annotations",
        export_path=output_path,
        content_hash=_content_hash(content),
        annotation_count=len(annotations)
    )


def export_side_notes(annotations: List[TideStationAnnotation],
                      output_path: str, batch_id: str,
                      version_id: str) -> ExportRecord:
    sections = []
    for ann in annotations:
        sections.append(f"===== {ann.station_name} [{ann.annotation_id}] =====")
        sections.append(ann.side_note)
        sections.append("")
    content = "\n".join(sections)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return ExportRecord(
        export_id=generate_id('exp'),
        batch_id=batch_id,
        version_id=version_id,
        export_type="side_notes",
        export_path=output_path,
        content_hash=_content_hash(content),
        annotation_count=len(annotations)
    )


def export_csv(annotations: List[TideStationAnnotation],
               output_path: str, batch_id: str,
               version_id: str) -> ExportRecord:
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        for ann in annotations:
            row = {h: ann.csv_row.get(h, '') for h in CSV_HEADERS}
            writer.writerow(row)

    with open(output_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return ExportRecord(
        export_id=generate_id('exp'),
        batch_id=batch_id,
        version_id=version_id,
        export_type="csv",
        export_path=output_path,
        content_hash=_content_hash(content),
        annotation_count=len(annotations)
    )


def export_version_trace(versions: List[AnnotationVersion],
                         output_path: str, batch_id: str) -> ExportRecord:
    reports = []
    for v in versions:
        reports.append(format_delta_report(v))
        reports.append("")
    content = "\n".join(reports)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return ExportRecord(
        export_id=generate_id('exp'),
        batch_id=batch_id,
        version_id=versions[-1].version_id if versions else '',
        export_type="version_trace",
        export_path=output_path,
        content_hash=_content_hash(content),
        annotation_count=len(versions)
    )


def verify_export_consistency(annotations: List[TideStationAnnotation],
                              csv_path: str, scene_path: str,
                              side_path: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "consistent": True,
        "mismatches": [],
        "count_check": {}
    }

    with open(scene_path, 'r', encoding='utf-8') as f:
        scene_lines = [l for l in f.read().splitlines() if l.strip()]
    if len(scene_lines) != len(annotations):
        result["consistent"] = False
        result["mismatches"].append(
            f"场景标注行数({len(scene_lines)})与标注数量({len(annotations)})不一致"
        )

    for i, ann in enumerate(annotations):
        if i < len(scene_lines) and scene_lines[i] != ann.scene_annotation:
            result["consistent"] = False
            result["mismatches"].append(f"第{i+1}条场景标注与内存标注不一致")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        csv_rows = list(reader)
    if len(csv_rows) != len(annotations):
        result["consistent"] = False
        result["mismatches"].append(
            f"CSV行数({len(csv_rows)})与标注数量({len(annotations)})不一致"
        )

    for i, ann in enumerate(annotations):
        if i < len(csv_rows):
            for key in CSV_HEADERS:
                if csv_rows[i].get(key, '') != ann.csv_row.get(key, ''):
                    result["consistent"] = False
                    result["mismatches"].append(
                        f"第{i+1}条CSV字段 {key} 不一致"
                    )
                    break

    result["count_check"] = {
        "annotations": len(annotations),
        "scene_lines": len(scene_lines),
        "csv_rows": len(csv_rows),
    }
    return result


def run_full_pipeline(source_files: List[str], output_dir: str,
                      extra_remarks: Optional[Dict[str, str]] = None
                      ) -> BatchProcessResult:
    extra_remarks = extra_remarks or {}
    os.makedirs(output_dir, exist_ok=True)

    batch_id = generate_id('batch')
    all_annotations: List[TideStationAnnotation] = []
    all_versions: List[AnnotationVersion] = []
    all_exports: List[ExportRecord] = []
    has_exceptions = False

    for src in source_files:
        anns = process_buoy_file(src, batch_id)
        all_annotations.extend(anns)

    for ann in all_annotations:
        if ann.status == AnnotationStatus.EXCEPTION:
            has_exceptions = True
        v0 = AnnotationVersion(
            version_id=generate_id('ver'),
            batch_id=batch_id,
            annotation_id=ann.annotation_id,
            version_number=1,
            annotation=deepcopy(ann),
            applied_remark=None,
            deltas=[]
        )
        all_versions.append(v0)

    v1_annotations = list(all_annotations)
    version_1_id = all_versions[-1].version_id if all_versions else generate_id('ver')

    scene_v1_path = os.path.join(output_dir, f"v1_scene_annotations_{batch_id}.txt")
    side_v1_path = os.path.join(output_dir, f"v1_side_notes_{batch_id}.txt")
    csv_v1_path = os.path.join(output_dir, f"v1_details_{batch_id}.csv")

    all_exports.append(export_scene_annotations(v1_annotations, scene_v1_path, batch_id, version_1_id))
    all_exports.append(export_side_notes(v1_annotations, side_v1_path, batch_id, version_1_id))
    all_exports.append(export_csv(v1_annotations, csv_v1_path, batch_id, version_1_id))

    if extra_remarks:
        reprocessed: List[TideStationAnnotation] = []
        for ann in all_annotations:
            remark = extra_remarks.get(ann.buoy_record.raw_log.log_id) or extra_remarks.get(ann.station_name)
            if remark:
                new_ann, new_version = apply_remark_and_version(ann, remark, 2)
                reprocessed.append(new_ann)
                all_versions.append(new_version)
            else:
                reprocessed.append(ann)

        version_2_id = all_versions[-1].version_id
        scene_v2_path = os.path.join(output_dir, f"v2_scene_annotations_{batch_id}.txt")
        side_v2_path = os.path.join(output_dir, f"v2_side_notes_{batch_id}.txt")
        csv_v2_path = os.path.join(output_dir, f"v2_details_{batch_id}.csv")
        trace_path = os.path.join(output_dir, f"version_trace_{batch_id}.txt")

        all_exports.append(export_scene_annotations(reprocessed, scene_v2_path, batch_id, version_2_id))
        all_exports.append(export_side_notes(reprocessed, side_v2_path, batch_id, version_2_id))
        all_exports.append(export_csv(reprocessed, csv_v2_path, batch_id, version_2_id))
        all_exports.append(export_version_trace(
            [v for v in all_versions if v.version_number == 2], trace_path, batch_id
        ))

        consistency_v2 = verify_export_consistency(reprocessed, csv_v2_path, scene_v2_path, side_v2_path)
        if not consistency_v2["consistent"]:
            has_exceptions = True

        all_annotations = reprocessed

    consistency_v1 = verify_export_consistency(
        [v.annotation for v in all_versions if v.version_number == 1],
        csv_v1_path, scene_v1_path, side_v1_path
    )
    if not consistency_v1["consistent"]:
        has_exceptions = True

    return BatchProcessResult(
        batch_id=batch_id,
        source_files=source_files,
        annotations=all_annotations,
        versions=all_versions,
        exports=all_exports,
        has_exceptions=has_exceptions
    )
