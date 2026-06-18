from __future__ import annotations

import os
import sys
import json

from coordinate_parser import parse_coordinates, CoordinateFormat
from tide_normalizer import normalize_tide, TideUnit
from annotation_engine import create_annotation, parse_buoy_log_line, build_buoy_record
from pipeline import (
    run_full_pipeline, safe_process_log_line, apply_remark_and_version,
    format_delta_report, verify_export_consistency
)
from models import AnnotationStatus
from handoff_verifier import run_handoff_verification, print_verification_report


def test_coordinate_parsing():
    print("\n=== 测试1: 经纬度多格式解析 ===")
    cases = [
        ("30.25°N", "121.50°E", CoordinateFormat.DECIMAL, 30.25, 121.50),
        ("29°58'30\"N", "121°30'45\"E", CoordinateFormat.DMS,
         29 + 58/60 + 30/3600, 121 + 30/60 + 45/3600),
        ("28°30.5'N", "120°45.2'E", CoordinateFormat.DDM,
         28 + 30.5/60, 120 + 45.2/60),
        ("30.5", "-122.3", CoordinateFormat.DECIMAL, 30.5, -122.3),
    ]
    all_ok = True
    for lat_raw, lng_raw, fmt_exp, lat_exp, lng_exp in cases:
        result = parse_coordinates(lat_raw, lng_raw)
        ok_lat = abs(result.latitude - lat_exp) < 0.0001
        ok_lng = abs(result.longitude - lng_exp) < 0.0001
        status = "✅" if (ok_lat and ok_lng) else "❌"
        if not (ok_lat and ok_lng):
            all_ok = False
        print(f"  {status} ({lat_raw}, {lng_raw}) -> "
              f"({result.latitude:.6f}, {result.longitude:.6f}) "
              f"[格式: {result.original_format.value}]")
        for note in result.parse_notes:
            print(f"      ⚠ {note}")
    return all_ok


def test_tide_normalization():
    print("\n=== 测试2: 潮位单位标准化（保留原始值） ===")
    cases = [
        ("2.8", "m", TideUnit.METERS, 2.8),
        ("320", "cm", TideUnit.CENTIMETERS, 3.2),
        ("8.5", "ft", TideUnit.FEET, 8.5 * 0.3048),
        ("150", "厘米", TideUnit.CENTIMETERS, 1.5),
        ("3.6", "公尺", TideUnit.METERS, 3.6),
        ("-0.3", "m", TideUnit.METERS, -0.3),
    ]
    all_ok = True
    for val, unit, unit_exp, m_exp in cases:
        result = normalize_tide(val, unit)
        ok_val = abs(result.value_meters - m_exp) < 0.0001
        ok_unit = result.original_unit == unit_exp
        status = "✅" if (ok_val and ok_unit) else "❌"
        if not (ok_val and ok_unit):
            all_ok = False
        print(f"  {status} '{val} {unit}' -> {result.value_meters:.4f} m "
              f"[原始: {result.original_value} {result.original_unit.value}]")
        for note in result.normalize_notes:
            print(f"      ℹ {note}")
    return all_ok


def test_annotation_consistency():
    print("\n=== 测试3: 场景标注/侧边说明/CSV 三源一致 ===")
    raw_text = "2026-06-17 08:30:00 30.25°N,121.50°E 钱江一号站 潮位: 2.8 m"
    raw_log = parse_buoy_log_line(raw_text, "test.txt", 1)
    record = build_buoy_record(raw_log)
    ann = create_annotation("batch_test", record)

    scene_has_tide = "2.8" in ann.scene_annotation and "m" in ann.scene_annotation
    side_has_raw = "30.25°N" in ann.side_note and "121.50°E" in ann.side_note
    csv_has_trace = ann.csv_row.get("raw_text") == raw_text
    csv_has_tide_level = ann.csv_row.get("tide_level") != ""

    checks = [
        ("场景标注含标准化潮位", scene_has_tide, ann.scene_annotation[:60] + "..."),
        ("侧边说明含原始经纬度", side_has_raw, ann.side_note[:60] + "..."),
        ("CSV保留原始浮标日志", csv_has_trace, ann.csv_row.get("raw_text", "")[:50]),
        ("CSV含潮位等级判定", csv_has_tide_level, ann.csv_row.get("tide_level", "")),
        ("CSV与场景潮位值一致", ann.csv_row.get("tide_meters", "") in ann.scene_annotation,
         f"csv={ann.csv_row.get('tide_meters')}"),
    ]
    all_ok = True
    for name, ok, detail in checks:
        print(f"  {'✅' if ok else '❌'} {name}: {detail}")
        if not ok:
            all_ok = False
    return all_ok


def test_remark_and_versioning():
    print("\n=== 测试4: 备注追加与版本对比（说明改变哪些判断） ===")
    raw_text = "2026-06-17 09:00:00 29°58'30\"N 121°30'45\"E 舟山海潮站 潮位: 320 cm"
    raw_log = parse_buoy_log_line(raw_text, "test.txt", 2)
    record = build_buoy_record(raw_log)
    ann_v1 = create_annotation("batch_remark", record)

    remark = "现场复核：该站潮位计基准面偏高50cm，实际潮位应减去0.5m"
    ann_v2, version = apply_remark_and_version(ann_v1, remark, 2)

    print(f"  原潮位等级: {ann_v1.csv_row['tide_level']}")
    print(f"  新潮位等级: {ann_v2.csv_row['tide_level']}")
    print(f"  版本变更项数: {len(version.deltas)}")

    report = format_delta_report(version)
    print(f"  变更报告生成: {'✅' if '影响' in report else '❌'}")
    for line in report.splitlines()[:8]:
        print(f"    | {line}")

    has_impact = any("影响" in d.judgment_impact for d in version.deltas)
    remark_preserved = remark in ann_v2.scene_annotation or remark in ann_v2.side_note
    print(f"  变更含判断影响: {'✅' if has_impact else '❌'}")
    print(f"  备注写入标注: {'✅' if remark_preserved else '❌'}")
    return has_impact and remark_preserved


def test_exception_preserves_raw():
    print("\n=== 测试5: 异常处理不丢失原始浮标日志线索 ===")
    bad_line = "2026-06-17 10:30:00 INVALID COORD 象山港站 潮位: 未知"
    ann, err = safe_process_log_line(bad_line, "test.txt", 5, "batch_exc")

    raw_in_scene = bad_line in ann.scene_annotation
    raw_in_side = bad_line in ann.side_note
    raw_in_csv = ann.csv_row.get("raw_text") == bad_line
    status_is_exception = ann.status == AnnotationStatus.EXCEPTION
    raw_trace_present = bool(ann.raw_trace)

    checks = [
        ("状态标记为异常", status_is_exception, str(ann.status)),
        ("原始日志在场景标注", raw_in_scene, ann.scene_annotation[:50]),
        ("原始日志在侧边说明", raw_in_side, ann.side_note[:50]),
        ("原始日志在CSV明细", raw_in_csv, ann.csv_row.get("raw_text", "")),
        ("raw_trace字段保留异常上下文", raw_trace_present, str(list(ann.raw_trace.keys()))),
    ]
    all_ok = True
    for name, ok, detail in checks:
        print(f"  {'✅' if ok else '❌'} {name}: {detail}")
        if not ok:
            all_ok = False
    return all_ok


def test_full_pipeline_and_handoff():
    print("\n=== 测试6: 全流程跑通 + 接班验证 ===")
    output_dir = "/Users/maca/pro/solo/workspaces/zy73133/test_output"
    source_file = "/Users/maca/pro/solo/workspaces/zy73133/sample_buoy_logs.txt"

    result = run_full_pipeline(
        [source_file],
        output_dir,
        extra_remarks={
            "舟山海潮站": "现场复核：该站潮位计基准面偏高50cm，实际潮位应减去0.5m",
        }
    )

    print(f"  batch_id: {result.batch_id}")
    print(f"  标注总数: {len(result.annotations)}")
    print(f"  版本记录数: {len(result.versions)}")
    print(f"  导出文件数: {len(result.exports)}")
    print(f"  存在异常: {'是' if result.has_exceptions else '否'}")

    for exp in result.exports:
        print(f"    导出: {exp.export_type} -> {os.path.basename(exp.export_path)}")

    v1_scene = os.path.join(output_dir, f"v1_scene_annotations_{result.batch_id}.txt")
    v1_csv = os.path.join(output_dir, f"v1_details_{result.batch_id}.csv")
    v1_side = os.path.join(output_dir, f"v1_side_notes_{result.batch_id}.txt")

    v1_anns = [v.annotation for v in result.versions if v.version_number == 1]
    consistency = verify_export_consistency(v1_anns, v1_csv, v1_scene, v1_side)
    print(f"  V1 三源一致性: {'✅ 通过' if consistency['consistent'] else '❌ 失败'}")
    if not consistency['consistent']:
        for m in consistency['mismatches']:
            print(f"    ! {m}")

    v2_exists = any("v2_" in e.export_path for e in result.exports)
    trace_exists = any("version_trace" in e.export_path for e in result.exports)
    print(f"  V2 重跑导出存在: {'✅' if v2_exists else '❌'}")
    print(f"  版本追溯报告存在: {'✅' if trace_exists else '❌'}")

    handoff_result = run_handoff_verification(output_dir, result.batch_id)
    print_verification_report(handoff_result)

    return handoff_result["passed"] and consistency["consistent"]


def main():
    print("=" * 60)
    print("  潮汐能站空间标注 - 全链路测试")
    print("=" * 60)

    results = [
        test_coordinate_parsing(),
        test_tide_normalization(),
        test_annotation_consistency(),
        test_remark_and_versioning(),
        test_exception_preserves_raw(),
        test_full_pipeline_and_handoff(),
    ]

    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"  综合结果: {passed}/{total} 项测试通过")
    if passed == total:
        print("  ✅ 全部通过")
    else:
        print("  ❌ 存在失败项")
    print("=" * 60)
    return passed == total


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
