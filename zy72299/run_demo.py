#!/usr/bin/env python3
import json
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import process_building, load_json_file
from history_manager import ResultFormatter


def demo_step1_import_origin():
    print("\n" + "=" * 70)
    print("【演示第一步】坐标原点说明第一次导入")
    print("=" * 70)

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

    result = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="演示-完整处理流程",
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
    )

    print("\n" + "=" * 70)
    print("【第一步完成】检测到以下待处理项：")
    print("=" * 70)

    conflicts = result.conflicts
    pending_reviews = result.pending_reviews

    print(f"\n数据冲突（需要园区运维小陶确认）：{len(conflicts)} 条")
    for i, c in enumerate(conflicts, 1):
        print(f"  {i}. 冲突ID: {c.conflict_id}")
        print(f"     涉及记录: {c.record_id}")
        print(f"     矛盾字段: {', '.join(c.conflicting_fields)}")
        print(f"     原点说明位置: {c.origin_data['position']}")
        print(f"     照片位置: {c.photo_data['position']}")

    print(f"\n待培训学员复核：{len(pending_reviews)} 条")
    for i, r in enumerate(pending_reviews, 1):
        print(f"  {i}. 记录ID: {r.record_id}")
        print(f"     障碍物名称: {r.obstacle_name}")
        print(f"     当前状态: {r.status.value}")
        if r.duplicate_of:
            print(f"     疑似与记录 {r.duplicate_of} 重复")

    return result


def demo_step2_xiaotao_review(conflict_id):
    print("\n" + "=" * 70)
    print("【演示第二步】园区运维小陶补看巡检照片编号，处理冲突")
    print("=" * 70)

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

    conflict_resolutions = [
        {
            "conflict_id": conflict_id,
            "resolution": "confirm_photo",
            "actor": "xiaotao",
        }
    ]

    print(f"\n园区运维小陶选择：确认巡检照片编号的数据")
    print(f"冲突 {conflict_id} 按 confirm_photo 处理")

    result = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="演示-园区运维小陶处理冲突",
        conflict_resolutions=conflict_resolutions,
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
    )

    remaining_conflicts = [c for c in result.conflicts if any(
        r.record_id == c.record_id and r.status.value == "conflict"
        for r in result.processed_records
    )]

    print(f"\n处理后剩余冲突：{len(remaining_conflicts)} 条")
    for r in result.processed_records:
        if r.status.value == "confirmed":
            print(f"\n已确认记录:")
            print(f"  记录ID: {r.record_id}")
            print(f"  障碍物: {r.obstacle_name}")
            print(f"  最终采信: {r.caliber_source}")
            print(f"  审核人: {r.reviewed_by}")
            print(f"  位置: ({r.position.x}, {r.position.y}, {r.position.z})")

    return result


def demo_step3_training_review(record_id):
    print("\n" + "=" * 70)
    print("【演示第三步】培训学员复核同一障碍物多名称问题")
    print("=" * 70)

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

    conflict_resolutions = []
    duplicate_resolutions = [
        {
            "record_id": record_id,
            "action": "keep_as_separate",
            "actor": "trainee",
        }
    ]

    print(f"\n培训学员选择：不急着归正常，保持为待复核状态")
    print(f"记录 {record_id} 按 keep_as_separate 处理，留给后续深入复核")

    result = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="演示-培训学员复核完成",
        conflict_resolutions=conflict_resolutions,
        duplicate_resolutions=duplicate_resolutions,
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
    )

    pending = [r for r in result.processed_records if r.status.value == "pending_review"]
    print(f"\n培训学员复核后状态：")
    for r in pending:
        print(f"\n待深入复核记录:")
        print(f"  记录ID: {r.record_id}")
        print(f"  障碍物名称: {r.obstacle_name}")
        print(f"  当前状态: {r.status.value} (培训学员复核中)")
        print(f"  复核人: {r.reviewed_by}")

    return result


def demo_final_summary():
    from history_manager import ResultFormatter as RF_local
    from view_updater import View3DUpdater

    print("\n" + "=" * 70)
    print("【最终演示】三步完整流程 + 三维标注视图更新")
    print("=" * 70)

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

    conflict_resolutions = [
        {
            "conflict_id": "PLACEHOLDER",
            "resolution": "confirm_photo",
            "actor": "xiaotao",
        }
    ]
    duplicate_resolutions = [
        {
            "record_id": "PLACEHOLDER",
            "action": "keep_as_separate",
            "actor": "trainee",
        }
    ]

    result1 = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="最终演示-完整三步流程",
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
    )

    if result1.conflicts:
        conflict_resolutions[0]["conflict_id"] = result1.conflicts[0].conflict_id
    if result1.pending_reviews:
        duplicate_resolutions[0]["record_id"] = result1.pending_reviews[0].record_id

    result2 = process_building(
        building_id="BUILDING_A",
        origin_spec=origin_spec,
        inspection_photos=all_photos,
        scenario_type="最终演示-完整三步流程",
        conflict_resolutions=conflict_resolutions,
        duplicate_resolutions=duplicate_resolutions,
        origin_file="sample_data/origin_spec_building_a.json",
        photo_file="sample_data/*_building_a_*.json",
    )

    RF_local.print_console_report(result2)

    print("\n" + "=" * 70)
    print("【三维标注视图状态摘要】")
    print("=" * 70)

    view_updater_result = None
    try:
        from view_updater import View3DUpdater
        from history_manager import ResultFormatter as RF
        updater = View3DUpdater(result2.processed_records)
        view_result = updater.generate_3d_view(
            building_id="BUILDING_A",
            origin_point=origin_spec["origin_point"],
        )
        view_state = view_result["view_state"]

        print(f"\n视图版本: {view_state['version']}")
        print(f"最后更新: {view_state['last_updated']}")
        print(f"图层数量: {len(view_state['layers'])}")

        print("\n图层详情:")
        for layer in view_state["layers"]:
            print(f"  - {layer['layer_name']}: {len(layer['record_ids'])} 条记录")
            print(f"    颜色: {layer['style']['color']}, 可见: {layer['visible']}")

        print("\n标注统计:")
        status_count = {}
        for ann in view_state["annotations"]:
            s = ann["status"]
            status_count[s] = status_count.get(s, 0) + 1

        for status, count in status_count.items():
            display = RF_local._get_status_display(status)
            print(f"  {display}: {count} 个标注")

    except Exception as e:
        print(f"视图生成详情: {e}")

    print("\n" + "=" * 70)
    print("【复盘命令】")
    print("=" * 70)
    print(f"\n{result2.replay_command}")

    print("\n" + "=" * 70)
    print("【历史记录时间线（最近5条）】")
    print("=" * 70)

    for entry in result2.history[-5:]:
        print(f"\n  时间: {entry.timestamp.strftime('%H:%M:%S')}")
        print(f"  操作: {entry.action}")
        print(f"  执行人: {entry.actor}")
        if entry.record_id:
            print(f"  涉及记录: {entry.record_id}")
        print(f"  详情: {json.dumps(entry.details, ensure_ascii=False)[:80]}...")

    with open("demo_result.json", "w", encoding="utf-8") as f:
        formatted = RF_local.format_result(result2)
        json.dump(formatted, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("演示完成！完整结果已保存到 demo_result.json")
    print("=" * 70 + "\n")

    return result2


if __name__ == "__main__":
    print("\n" + "#" * 70)
    print("# 楼宇外立面清洗路径 - 完整处理流程演示")
    print("# 包含：正常记录、同一障碍物多名称、旧口径补录三种场景")
    print("#" * 70)

    if len(sys.argv) > 1 and sys.argv[1] == "--full":
        result1 = demo_step1_import_origin()
        if result1.conflicts:
            result2 = demo_step2_xiaotao_review(result1.conflicts[0].conflict_id)
        if result1.pending_reviews:
            result3 = demo_step3_training_review(result1.pending_reviews[0].record_id)
        demo_final_summary()
    else:
        demo_final_summary()
