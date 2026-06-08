#!/usr/bin/env python3
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import process_building, load_json_file
from history_manager import ResultFormatter as RF


def _load_all():
    origin_spec = load_json_file("sample_data/origin_spec_building_a.json")
    all_photos = []
    for photo_file in [
        "inspection_photos_building_a_normal.json",
        "inspection_photos_building_a_duplicate.json",
        "inspection_photos_building_a_supplement.json",
        "inspection_photos_building_a_conflict.json",
    ]:
        data = load_json_file(f"sample_data/{photo_file}")
        all_photos.extend(data["photos"])
    return origin_spec, all_photos


def _print_hr(char="=", length=70, title=None):
    if title:
        line = f" {title} "
        pad = (length - len(line)) // 2
        print(f"\n{char * pad}{line}{char * pad}")
    else:
        print("\n" + char * length)


def _diff_statuses(result_prev, result_curr):
    prev_map = {r.record_id: r.status.value for r in result_prev.processed_records}
    curr_map = {r.record_id: r.status.value for r in result_curr.processed_records}
    changed = []
    for rid in set(list(prev_map.keys()) + list(curr_map.keys())):
        if prev_map.get(rid) != curr_map.get(rid):
            changed.append({
                "record_id": rid,
                "prev": prev_map.get(rid, "<新增>"),
                "curr": curr_map.get(rid, "<删除>"),
            })
    return changed


def _summary_view_state(result):
    if not result.view_state:
        return "(视图未输出)"
    vs = result.view_state
    cons = vs.get("view_record_consistency", {})
    cons_flag = "✓" if cons.get("consistent") else f"✗{cons.get('issue_count')}"
    layer_info = ", ".join([
        f"{l['layer_name']}:{l['record_count']}"
        for l in vs.get("layers", []) if l.get("record_count", 0) > 0
    ])
    return (f"v{vs.get('version')} | 图层{vs.get('layer_count',0)} | 标注{vs.get('annotation_count',0)} | "
            f"一致性{cons_flag} | [{layer_info}]")


def step0_verify_environment():
    _print_hr("=", 70, "步骤0 环境与数据自检")
    print("工作目录:", os.getcwd())
    print("依赖: models.py/coordinate_importer.py/photo_matcher.py/conflict_detector.py/view_updater.py/history_manager.py/main.py")
    origin_spec, all_photos = _load_all()
    print(f"坐标原点说明记录数: {len(origin_spec['obstacles'])}")
    print(f"巡检照片总数: {len(all_photos)}")
    print("样例已准备: 正常×2 + 重复×2 + 补录×2 + 冲突×2 = 8条照片数据")


def step1_import_and_match():
    _print_hr("=", 70, "步骤1 坐标原点说明导入 → 园区运维小陶补看巡检照片编号")
    origin_spec, all_photos = _load_all()

    result = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="演示-第1步_导入匹配",
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
        include_view=True,
    )

    _print_hr("-", 70, "步骤1 结果")
    print(f"记录总数: {len(result.processed_records)}")
    print(f"待复核数: {len(result.pending_reviews)}")
    print(f"冲突数: {len(result.conflicts)}")
    print(f"视图状态: {_summary_view_state(result)}")
    print(f"版本链: {[(v['version'], v['trigger_reason']) for v in result.view_versions]}")
    print(f"复核痕迹: {len(result.review_trails)} 条")
    print(f"复盘命令: {result.replay_command[:120]}...")
    return result


def step2_apply_resolutions(step1_result):
    _print_hr("=", 70, "步骤2 应用重复名称决议 + 冲突决议 → 触发视图版本递增")

    origin_spec, all_photos = _load_all()

    pending_id = step1_result.pending_reviews[0].record_id if step1_result.pending_reviews else None
    conflict_id = step1_result.conflicts[0].conflict_id if step1_result.conflicts else None

    duplicate_resolutions = []
    if pending_id:
        duplicate_resolutions = [{
            "record_id": pending_id,
            "action": "keep_as_separate",
            "actor": "xiaotao",
        }]
    conflict_resolutions = []
    if conflict_id:
        conflict_resolutions = [{
            "conflict_id": conflict_id,
            "resolution": "confirm_photo",
            "actor": "xiaotao",
        }]

    print(f"应用决议:")
    if duplicate_resolutions:
        print(f"  · 重复名称: {duplicate_resolutions[0]['record_id']} → keep_as_separate (留给培训学员)")
    if conflict_resolutions:
        print(f"  · 冲突: {conflict_resolutions[0]['conflict_id']} → confirm_photo (采信巡检照片编号)")

    result = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="演示-第2步_决议应用",
        conflict_resolutions=conflict_resolutions,
        duplicate_resolutions=duplicate_resolutions,
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
        include_view=True,
    )

    _print_hr("-", 70, "步骤2 vs 步骤1 对比")
    diffs = _diff_statuses(step1_result, result)
    print(f"记录状态变更数: {len(diffs)}")
    for d in diffs:
        rec = next((r for r in result.processed_records if r.record_id == d['record_id']), None)
        name = rec.obstacle_name if rec else ''
        print(f"  · {d['record_id']} ({name}): {d['prev']} → {d['curr']}")

    print(f"步骤1视图: {_summary_view_state(step1_result)}")
    print(f"步骤2视图: {_summary_view_state(result)}")
    print(f"视图版本变更: {[(v['version'], v['trigger_reason']) for v in result.view_versions]}")
    print(f"清洗路径版本: v{result.cleaning_path.version if result.cleaning_path else 'N/A'}")

    for trail in result.review_trails:
        print(f"\n复核痕迹 {trail.trail_id}:")
        print(f"  变更: {trail.changed_fields}")
        print(f"  原始→改后: ", end="")
        for f in trail.changed_fields:
            print(f"{f}: {trail.original_value.get(f)}→{trail.modified_value.get(f)}  ", end="")
        print()
        print(f"  原因: {trail.reason[:80]}")
        print(f"  下一步找谁: → {trail.next_handler}")

    return result


def step3_view_record_alignment(step2_result):
    _print_hr("=", 70, "步骤3 三维标注视图 ↔ 记录 ↔ 历史 三向一致性核对")

    vs = step2_result.view_state
    if not vs:
        print("视图未输出，跳过核对。")
        return

    cons = vs["view_record_consistency"]
    cross = RF._cross_check_view_history(
        step2_result.view_versions,
        step2_result.history,
        step2_result.processed_records,
    )

    print("\n【A】视图 vs 记录一致性:")
    print(f"  结果: {'✓一致' if cons['consistent'] else '✗不一致'}，问题数: {cons['issue_count']}")
    for issue in cons.get("issues", []):
        print(f"    · [{issue['type']}] {issue.get('record_id','')}: {issue['detail']}")

    print("\n【B】视图版本链 vs 历史记录 BUMP_VIEW_VERSION:")
    print(f"  view_versions 版本数: {len(step2_result.view_versions)}")
    print(f"  history 中 BUMP 动作数: {sum(1 for h in step2_result.history if h.action == 'BUMP_VIEW_VERSION')}")
    print(f"  交叉一致性: {'✓' if cross['consistent'] else '✗'}，问题数: {cross['issue_count']}")
    for issue in cross.get("issues", []):
        print(f"    · [{issue['type']}]: {issue['detail']}")

    print("\n【C】视图标注 vs 实际记录 逐条对应:")
    view_ann = {a["record_id"]: a for a in vs["annotations"]}
    all_match = True
    for rec in step2_result.processed_records:
        ann = view_ann.get(rec.record_id)
        issues = []
        if not ann:
            issues.append("缺少标注")
            all_match = False
        else:
            if ann["status"] != rec.status.value:
                issues.append(f"状态不符 标注={ann['status']} 记录={rec.status.value}")
                all_match = False
            if abs(ann["position"]["x"] - rec.position.x) > 0.001 or \
               abs(ann["position"]["y"] - rec.position.y) > 0.001 or \
               abs(ann["position"]["z"] - rec.position.z) > 0.001:
                issues.append(f"坐标不符")
                all_match = False
        mark = "✓" if not issues else "✗"
        issue_str = f" → {'; '.join(issues)}" if issues else ""
        print(f"  {mark} {rec.record_id} | {rec.obstacle_name} | {rec.status.value}{issue_str}")

    print(f"\n  总结: {'全部对齐 ✓' if all_match else '存在不一致 ✗，需修复'}")

    print("\n【D】可重新跑命令验证 (复制即可执行):")
    print(f"  {step2_result.replay_command}")

    print("\n【E】历史记录 & 视图版本 & 清洗路径 关联:")
    path = step2_result.cleaning_path
    if path:
        print(f"  清洗路径版本 v{path.version} = 视图版本 v{vs['version']} : "
              f"{'✓相等' if path.version == vs['version'] else '✗不等'}")


def final_report_and_export(step2_result):
    _print_hr("=", 70, "导出最终结果 (含视图/记录/命令/复核痕迹)")

    formatted = RF.format_result(
        step2_result,
        include_history=True,
        include_view=True,
        include_review_trails=True,
    )

    output_path = "demo_final_result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(formatted, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"已导出 → {output_path} ({size_kb:.1f} KB)")
    print(f"  顶层字段: {', '.join(formatted.keys())}")
    print(f"  view_state: {bool(formatted.get('view_state'))}")
    print(f"  view_versions: {len(formatted.get('view_versions', []))} 条")
    print(f"  history_timeline: {len(formatted.get('history_timeline', []))} 条")
    print(f"  review_trails: {len(formatted.get('review_trails', []))} 条")
    print(f"  review_trace_matrix: {len(formatted.get('review_trace_matrix', []))} 条")
    print(f"  replay_command: {formatted.get('replay_command')[:100]}...")

    RF.print_console_report(step2_result, include_view=True)


def run_full_demo():
    step0_verify_environment()
    r1 = step1_import_and_match()
    r2 = step2_apply_resolutions(r1)
    step3_view_record_alignment(r2)
    final_report_and_export(r2)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        origin_spec, all_photos = _load_all()
        r = process_building(
            building_id="BUILDING_A",
            origin_spec=origin_spec,
            inspection_photos=all_photos,
            scenario_type="快速验证",
            origin_file="sample_data/origin_spec_building_a.json",
            photo_file="sample_data/*_building_a_*.json",
            include_view=True,
        )
        RF.print_console_report(r, include_view=True)
        with open("result_quick.json", "w", encoding="utf-8") as f:
            json.dump(RF.format_result(r), f, ensure_ascii=False, indent=2)
        print(f"快速结果 → result_quick.json")
    else:
        run_full_demo()
