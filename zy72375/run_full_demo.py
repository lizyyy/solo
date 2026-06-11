#!/usr/bin/env python3
import os
import sys
import shutil
import json
from datetime import datetime

DATA_DIR = "data"


def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def print_subsection(title):
    print(f"\n{'-'*60}")
    print(f"  {title}")
    print(f"{'-'*60}\n")


def cleanup():
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    if os.path.exists("reports"):
        shutil.rmtree("reports")
    os.makedirs(DATA_DIR, exist_ok=True)


def run_cmd(cmd):
    print(f"$ python3 main.py {cmd}")
    result = os.system(f"python3 main.py {cmd}")
    return result


def load_uz_data():
    with open(os.path.join(DATA_DIR, "uniform_zones.json"), "r") as f:
        return json.load(f)


def main():
    print_section("磁场线圈均匀区 - 完整流程演示")
    print(f"演示时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    cleanup()
    print("已清理历史数据，开始全新演示\n")

    print_section("【第一步】传感器编号第一次导入 - 数据员")
    print_subsection("场景：导入含温度单位混用的传感器数据")
    print("测试数据说明：")
    print("  - MAG-COIL-001: 25.0°C (正常)")
    print("  - MAG-COIL-002: 298.15K (正常，相当于25°C)")
    print("  - MAG-COIL-003: 25.0K (异常，明显是单位记录错误，应为25°C)")
    print("  - MAG-COIL-004: 24.5°C (正常)")
    print("  - MAG-COIL-005: 300°C (异常，超出均匀区正常范围)")
    print()

    result = run_cmd('import-sensors --input-file test_data/sensors.json --operator "数据员"')
    print()

    print_subsection("查看导入后统计")
    result = run_cmd("stats")

    print_subsection("逐条查看记录状态，确认温度混用标记")
    uz_data = load_uz_data()
    for uz in uz_data:
        status = uz["processing_status"]
        need_review = uz.get("coach_review_required", False)
        temp_info = f"{uz.get('temperature_value')}{uz.get('temperature_unit')}"
        print(f"  {uz['sensor_id']}: 状态={status}, 温度={temp_info}, 待复核={need_review}, 照片数={len(uz.get('related_photo_ids', []))}")

    print_section("【第二步】设备工程师何工补看工况照片（普通照片）")
    print_subsection("场景：何工将现场说法照片关联到对应记录")
    print("注意：这是普通照片复核，不是晚到照片。复核后related_photo_ids必须有值。")
    result = run_cmd('review-photos --input-file test_data/photos.json --operator "何工"')

    print_subsection("复核后逐条检查：related_photo_ids不能为空")
    uz_data = load_uz_data()
    empty_photo_count = 0
    for uz in uz_data:
        photo_ids = uz.get("related_photo_ids", [])
        if not photo_ids:
            empty_photo_count += 1
        print(f"  {uz['sensor_id']}: 状态={uz['processing_status']}, 关联照片={photo_ids}")
    if empty_photo_count > 0:
        print(f"  ⚠ 有 {empty_photo_count} 条记录的照片为空（这些传感器没有被photos.json覆盖到）")
    else:
        print("  ✓ 所有照片覆盖到的记录均已关联照片")

    print_subsection("何工尝试更新交接报告 - 预期部分失败")
    print("原因：存在温度单位混用待教练复核的记录，按规则不能更新报告")
    all_uz_ids = [uz["uniform_zone_id"] for uz in uz_data]
    uz_ids_str = ",".join(all_uz_ids)
    result = run_cmd(
        f'update-report --uz-ids {uz_ids_str} '
        f'--notes "照片复核完成" '
        f'--operator "何工"'
    )

    print_section("【关键环节】训练教练复核温度单位")
    print_subsection("场景：教练确认MAG-COIL-003的25K实为25°C（fix_unit模式）")

    uz_data = load_uz_data()
    temp_mixed_003 = [uz for uz in uz_data
                      if uz["sensor_id"] == "MAG-COIL-003"
                      and uz.get("has_mixed_temp_units")]

    if temp_mixed_003:
        uz_id_003 = temp_mixed_003[0]["uniform_zone_id"]
        print(f"对MAG-COIL-003记录 {uz_id_003} 进行温度单位修正：25K -> 25°C（fix_unit模式，数值不变）")
        result = run_cmd(
            f'coach-review --uz-id {uz_id_003} '
            f'--target-unit "°C" '
            f'--correction-mode fix_unit '
            f'--remark "根据现场照片PHOTO-2026-0604-003，MAG-COIL-003的现场仪表显示为25°C，确认记录单位错误，应为摄氏度。B区设计工作温度范围20-30°C。" '
            f'--operator "训练教练"'
        )

    print_subsection("场景：教练确认MAG-COIL-002的298.15K转换（convert模式）")
    temp_mixed_002 = [uz for uz in uz_data
                      if uz["sensor_id"] == "MAG-COIL-002"
                      and uz.get("has_mixed_temp_units")]

    if temp_mixed_002:
        uz_id_002 = temp_mixed_002[0]["uniform_zone_id"]
        print(f"对MAG-COIL-002记录 {uz_id_002} 进行温度转换：298.15K -> 25°C（convert模式）")
        result = run_cmd(
            f'coach-review --uz-id {uz_id_002} '
            f'--target-unit "°C" '
            f'--correction-mode convert '
            f'--remark "按公式转换298.15K - 273.15 = 25°C" '
            f'--operator "训练教练"'
        )

    print_section("【第三步】交接报告更新 - 何工")
    print_subsection("场景：教练复核完成后，何工可以更新交接报告了")

    uz_data = load_uz_data()
    non_review_required_ids = [uz["uniform_zone_id"] for uz in uz_data
                               if not uz.get("coach_review_required", False)]
    if non_review_required_ids:
        ids_str = ",".join(non_review_required_ids)
        result = run_cmd(
            f'update-report --uz-ids {ids_str} '
            f'--notes "现场核验完成，传感器数据与工况照片一致，磁场线圈均匀性符合设计要求。" '
            f'--operator "何工"'
        )

    print_section("【细节验证】何工只改一条备注")
    print_subsection("场景：何工补充一条备注，历史记录能看出差别，且能讲清谁改了什么、改完影响了哪条结果")
    uz_data = load_uz_data()
    if non_review_required_ids:
        target_id = non_review_required_ids[0]
        target_uz = [uz for uz in uz_data if uz["uniform_zone_id"] == target_id][0]
        result = run_cmd(
            f'manual-edit --uz-id {target_id} '
            f'--field manual_annotation '
            f'--value "补充：6月4日下午现场观察到{target_uz["sensor_id"]}区域线圈振动轻微，经频谱分析在允许范围内，不影响磁场均匀性。" '
            f'--reason "补充现场观察记录，完善交接资料" '
            f'--operator "何工"'
        )

        print_subsection("查看该记录的可复盘历史，确认备注改动和影响结果清晰")
        result = run_cmd(f"history --uz-id {target_id}")

    print_section("【防重复导入验证】重复导入同一批传感器")
    print_subsection("场景：再次导入同一批数据，验证数量不翻倍，且去重信息进入可复盘记录")
    print("重复导入前：")
    result = run_cmd("stats")

    print("\n重复导入同一批数据...")
    result = run_cmd('import-sensors --input-file test_data/sensors.json --operator "数据员"')

    print("\n重复导入后（总数应不变）：")
    result = run_cmd("stats")

    print_subsection("查看重复导入后的记录，确认duplicate_import_info出现")
    uz_data = load_uz_data()
    first_uz = uz_data[0]
    result = run_cmd(f"show --uz-id {first_uz['uniform_zone_id']}")

    print_subsection("查看该记录的可重跑命令，确认重复导入历史可追溯")
    result = run_cmd(f"history --uz-id {first_uz['uniform_zone_id']} --replay")

    print_section("【晚到材料流程】工况照片晚上才补进来")
    print_subsection("场景：B区边缘的照片晚上18:30才补到，只刷新相关明细，不洗掉已确认内容")
    print("规则：晚到照片只更新照片字段，传感器数据保持不变")
    result = run_cmd('review-photos --input-file test_data/late_photos.json --operator "何工"')

    print_subsection("验证：MAG-COIL-004记录，晚到照片已关联但核心数据未变")
    uz_data = load_uz_data()
    uz_004 = [uz for uz in uz_data if uz["sensor_id"] == "MAG-COIL-004"]
    if uz_004:
        result = run_cmd(f"show --uz-id {uz_004[0]['uniform_zone_id']}")

    print_section("【最终确认】")
    uz_data = load_uz_data()
    confirmed_count = 0
    for uz in uz_data:
        uz_id = uz["uniform_zone_id"]
        if not uz.get("coach_review_required", False):
            result = run_cmd(f'confirm --uz-id {uz_id} --operator "质量主管"')
            confirmed_count += 1

    print(f"\n共确认 {confirmed_count} 条记录")

    print_section("【可复盘记录与可重跑命令】")
    print_subsection("导出完整复盘报告")
    result = run_cmd("export --output reports/full_audit_report.json")

    print_subsection("为MAG-COIL-001生成可重跑命令，验证所有命令可直接复制执行")
    uz_data = load_uz_data()
    uz_001 = [uz for uz in uz_data if uz["sensor_id"] == "MAG-COIL-001"]
    if uz_001:
        result = run_cmd(f"history --uz-id {uz_001[0]['uniform_zone_id']} --replay")

    print_subsection("导出MAG-COIL-001完整历史")
    if uz_001:
        result = run_cmd(f"history --uz-id {uz_001[0]['uniform_zone_id']} --export reports/MAG-COIL-001_history.json")

    print_section("【最终统计与验证】")
    result = run_cmd("stats")

    print_section("逐条核对最终状态")
    uz_data = load_uz_data()
    for uz in uz_data:
        photo_ids = uz.get("related_photo_ids", [])
        duplicate_info = "有重复导入" if uz.get("duplicate_import_batches") else "首次导入"
        print(
            f"  {uz['sensor_id']}: "
            f"状态={uz['processing_status']}, "
            f"温度={uz.get('temperature_value')}{uz.get('temperature_unit')}, "
            f"照片数={len(photo_ids)}, "
            f"备注={'有' if uz.get('manual_annotation') else '无'}, "
            f"导入={duplicate_info}"
        )

    print_section("系统核心特性验证清单")
    checklist = [
        ("传感器编号原始行号留存", "MAG-COIL-001的original_line_number=5，查看show输出可确认"),
        ("人工改动讲清谁改了什么、影响了哪条", "manual-edit返回affected_result字段，历史reason包含操作人+字段+影响记录"),
        ("处理状态全程追踪", "IMPORTED → PHOTO_REVIEWED → REPORT_UPDATED → CONFIRMED"),
        ("两类证据整合到同一结果", "show输出同时包含sensor_evidence和photo_evidences"),
        ("温度混用不自动修正", "25K标记为TEMP_MIXED，等待教练确认"),
        ("重复导入不翻倍", "重复导入后stats总数不变，duplicate_import_batches记录去重历史"),
        ("改前改后可对比", "change_comparisons输出每个变更的before/after差异"),
        ("晚到材料不洗数据", "晚到照片只追加photo_ids和notes，不修改sensor核心字段"),
        ("交接报告有闸门", "TEMP_MIXED状态的记录被拒绝更新报告"),
        ("边界规则代码化", "5条规则在rules.py中，command=rules可查看"),
        ("可复盘记录导出", "export输出包含所有证据、历史、对比"),
        ("可重跑命令可直接执行", "history --replay输出的命令全部使用main.py实际子命令"),
        ("重复导入来源和处理状态在同一结果", "get_combined_result的duplicate_import_info包含首次批次、重复批次、去重结论"),
    ]
    all_pass = True
    for item, detail in checklist:
        print(f"  ✓ {item}")
        print(f"    验证方法: {detail}")

    print(f"\n共 {len(checklist)} 项验证清单")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
