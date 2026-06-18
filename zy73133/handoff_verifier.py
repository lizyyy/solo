from __future__ import annotations

import csv
import os
import sys
from typing import List, Dict, Any


def run_handoff_verification(output_dir: str, batch_id: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "passed": True,
        "steps": [],
        "errors": [],
        "summary": ""
    }

    csv_path = os.path.join(output_dir, f"v2_details_{batch_id}.csv")
    if not os.path.exists(csv_path):
        csv_path = os.path.join(output_dir, f"v1_details_{batch_id}.csv")

    scene_path = os.path.join(output_dir, f"v2_scene_annotations_{batch_id}.txt")
    if not os.path.exists(scene_path):
        scene_path = os.path.join(output_dir, f"v1_scene_annotations_{batch_id}.txt")

    side_path = os.path.join(output_dir, f"v2_side_notes_{batch_id}.txt")
    if not os.path.exists(side_path):
        side_path = os.path.join(output_dir, f"v1_side_notes_{batch_id}.txt")

    def step(name: str, passed: bool, detail: str = ""):
        result["steps"].append({"name": name, "passed": passed, "detail": detail})
        if not passed:
            result["passed"] = False
            result["errors"].append(f"[{name}] {detail}")

    step("步骤1: 检查导出文件存在", os.path.exists(csv_path),
         f"CSV: {csv_path} | 场景: {scene_path} | 侧边: {side_path}")

    if not os.path.exists(csv_path):
        result["summary"] = "导出文件缺失，验证终止"
        return result

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        csv_rows = list(reader)

    step("步骤2: CSV 含必填追溯字段", all(h in reader.fieldnames for h in [
        "raw_text", "source_ref", "latitude_raw", "longitude_raw",
        "tide_original", "record_id", "log_id"
    ]), f"实际字段: {reader.fieldnames}")

    step("步骤3: CSV 行数非零", len(csv_rows) > 0, f"行数: {len(csv_rows)}")

    for i, row in enumerate(csv_rows, 1):
        station = row.get('station_name', f'第{i}行')
        issues_text = row.get('issues', '')
        is_exception = 'EXCEPTION' in issues_text or '解析错误' in issues_text or '解析失败' in issues_text

        step(f"步骤4.{i}: {station} 原始浮标日志可追溯",
             bool(row.get('raw_text')) and bool(row.get('source_ref')),
             f"raw_text={'有' if row.get('raw_text') else '无'}, "
             f"source_ref={row.get('source_ref', 'N/A')}")

        has_lat_lng_raw = bool(row.get('latitude_raw')) and bool(row.get('longitude_raw'))
        raw_text_has_coord = bool(row.get('raw_text')) and any(
            c in row.get('raw_text', '') for c in ['N', 'S', 'E', 'W', '°', '.', ',']
        )
        step(f"步骤4.{i}: {station} 原始经纬度未被洗掉",
             has_lat_lng_raw or (is_exception and bool(row.get('raw_text'))),
             f"lat_raw={row.get('latitude_raw', 'N/A')}, "
             f"lng_raw={row.get('longitude_raw', 'N/A')}, "
             f"raw_text完整={'是' if bool(row.get('raw_text')) else '否'}")

        has_tide_raw = bool(row.get('tide_original')) and row.get('tide_original') not in ('N/A', '(单位未知)')
        raw_text_has_tide = bool(row.get('raw_text')) and '潮位' in row.get('raw_text', '')
        step(f"步骤4.{i}: {station} 原始潮位和单位可追溯",
             has_tide_raw or (is_exception and raw_text_has_tide),
             f"tide_original={row.get('tide_original', 'N/A')}, "
             f"tide_unit_raw={row.get('tide_unit_raw', 'N/A')}")

        step(f"步骤4.{i}: {station} 标准化经纬度有效",
             bool(row.get('latitude')) and bool(row.get('longitude')) and row.get('latitude') != 'N/A',
             f"lat={row.get('latitude', 'N/A')}, lng={row.get('longitude', 'N/A')}")

        step(f"步骤4.{i}: {station} 标准化潮位非空",
             bool(row.get('tide_meters')) and row.get('tide_meters') != 'N/A',
             f"tide_m={row.get('tide_meters', 'N/A')}")

        step(f"步骤4.{i}: {station} 潮位等级判定有依据",
             bool(row.get('tide_level')) and row.get('tide_level') != '未知',
             f"tide_level={row.get('tide_level', 'N/A')}")

        if is_exception:
            step(f"步骤4.{i}: {station} 异常记录保留原始线索",
                 bool(row.get('raw_text')),
                 f"异常线索已保留在 raw_text 字段")

    if os.path.exists(scene_path):
        with open(scene_path, 'r', encoding='utf-8') as f:
            scene_lines = [l for l in f.read().splitlines() if l.strip()]

        step("步骤5: 场景标注行数与 CSV 一致",
             len(scene_lines) == len(csv_rows),
             f"场景={len(scene_lines)}, CSV={len(csv_rows)}")

        for i, row in enumerate(csv_rows):
            if i < len(scene_lines):
                station = row.get('station_name', f'第{i}行')
                tide_in_scene = row.get('tide_original', '') in scene_lines[i]
                coord_in_scene = row.get('latitude', '') in scene_lines[i]
                step(f"步骤5.{i}: {station} 场景标注与 CSV 潮位一致",
                     tide_in_scene or coord_in_scene,
                     f"场景行包含原始潮位/坐标: {tide_in_scene}/{coord_in_scene}")

    if os.path.exists(side_path):
        with open(side_path, 'r', encoding='utf-8') as f:
            side_content = f.read()
        for i, row in enumerate(csv_rows):
            station = row.get('station_name', f'第{i}行')
            raw_in_side = row.get('raw_text', '') in side_content
            tide_in_side = row.get('tide_original', '') in side_content
            step(f"步骤6.{i}: {station} 侧边说明含原始日志",
                 raw_in_side or tide_in_side,
                 f"含原始日志={raw_in_side}, 含原始潮位={tide_in_side}")

    trace_path = os.path.join(output_dir, f"version_trace_{batch_id}.txt")
    if os.path.exists(trace_path):
        with open(trace_path, 'r', encoding='utf-8') as f:
            trace_content = f.read()
        step("步骤7: 版本追溯文件含变更影响说明",
             "影响" in trace_content or "变更" in trace_content,
             f"版本追溯文件存在，长度={len(trace_content)}")

    errors_count = len(result["errors"])
    steps_count = len(result["steps"])
    passed_count = sum(1 for s in result["steps"] if s["passed"])
    result["summary"] = (
        f"接班验证完成: {passed_count}/{steps_count} 项通过"
        + (f"，失败 {errors_count} 项" if errors_count else "")
    )

    return result


def print_verification_report(result: Dict[str, Any]):
    print("=" * 60)
    print("  潮汐能站空间标注 - 接班流程验证报告")
    print("=" * 60)
    print(f"\n总结果: {'✅ 通过' if result['passed'] else '❌ 失败'}")
    print(f"{result['summary']}\n")

    print("--- 详细步骤 ---")
    for s in result["steps"]:
        mark = "✅" if s["passed"] else "❌"
        print(f"  {mark} {s['name']}")
        if s["detail"]:
            print(f"     {s['detail']}")

    if result["errors"]:
        print("\n--- 失败项汇总 ---")
        for e in result["errors"]:
            print(f"  ! {e}")

    print()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python handoff_verifier.py <output_dir> <batch_id>")
        sys.exit(1)
    out_dir = sys.argv[1]
    bid = sys.argv[2]
    res = run_handoff_verification(out_dir, bid)
    print_verification_report(res)
    sys.exit(0 if res["passed"] else 1)
