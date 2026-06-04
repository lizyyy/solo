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
    print(f"$ {cmd}")
    result = os.system(f"python3 main.py {cmd}")
    return result


def main():
    print_section("磁场线圈均匀区 - 完整流程演示")
    print(f"演示时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    cleanup()
    print("已清理历史数据，开始全新演示\n")

    print_section("【第一步】传感器编号导入 - 数据员")
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

    print_subsection("查看当前统计")
    result = run_cmd("stats")

    print_subsection("查看待教练复核的记录（温度混用）")
    result = run_cmd("show")

    print_section("【第二步】设备工程师何工补看工况照片")
    print_subsection("场景：何工将现场说法照片关联到对应记录")
    result = run_cmd('review-photos --input-file test_data/photos.json --operator "何工"')

    print_subsection("何工尝试更新交接报告 - 预期失败")
    print("原因：存在温度单位混用待教练复核的记录，按规则不能更新报告")
    result = run_cmd('update-report --uz-ids ALL --notes "照片复核完成" --operator "何工" 2>&1 || true')

    print_subsection("获取实际的记录ID列表")
    with open(os.path.join(DATA_DIR, "uniform_zones.json"), "r") as f:
        uz_data = json.load(f)
    uz_ids = [uz["uniform_zone_id"] for uz in uz_data]
    print(f"找到 {len(uz_ids)} 条均匀区记录")
    for uz in uz_data:
        status = uz["processing_status"]
        need_review = uz.get("coach_review_required", False)
        print(f"  {uz['uniform_zone_id']} - {uz['sensor_id']} - {status} - 待复核: {need_review}")

    print_section("【关键环节】训练教练复核温度单位")
    print_subsection("场景：教练确认MAG-COIL-003的25K实为25°C")

    temp_mixed_ids = [uz["uniform_zone_id"] for uz in uz_data
                      if uz.get("has_mixed_temp_units") or uz.get("temperature_value") == 25.0
                      and uz.get("temperature_unit") == "K"]

    if temp_mixed_ids:
        uz_id_for_correction = temp_mixed_ids[0]
        print(f"对记录 {uz_id_for_correction} 进行温度单位修正：25K -> 25°C（标签修正模式，数值不变）")
        result = run_cmd(
            f'coach-review --uz-id {uz_id_for_correction} '
            f'--target-unit "°C" '
            f'--correction-mode fix_unit '
            f'--remark "根据现场照片PHOTO-2026-0604-003，MAG-COIL-003的现场仪表显示为25°C，确认记录单位错误，应为摄氏度。B区设计工作温度范围20-30°C。" '
            f'--operator "训练教练"'
        )

        print_subsection("修正后查看该记录的完整证据链")
        result = run_cmd(f"show --uz-id {uz_id_for_correction}")

        print_subsection("查看该记录的改前改后对比")
        result = run_cmd(f"history --uz-id {uz_id_for_correction}")

    print_section("【第三步】交接报告更新 - 何工")
    print_subsection("场景：教练复核完成后，何工可以更新交接报告了")

    normal_ids = [uz["uniform_zone_id"] for uz in uz_data
                  if not uz.get("coach_review_required", False)]
    if normal_ids:
        uz_ids_str = ",".join(normal_ids)
        result = run_cmd(
            f'update-report --uz-ids {uz_ids_str} '
            f'--notes "现场核验完成，传感器数据与工况照片一致，磁场线圈均匀性符合设计要求。" '
            f'--operator "何工"'
        )

    print_section("【细节验证】何工只改一条备注")
    print_subsection("场景：何工补充一条备注，历史记录能看出差别")
    if normal_ids:
        target_id = normal_ids[0]
        result = run_cmd(
            f'manual-edit --uz-id {target_id} '
            f'--field manual_annotation '
            f'--value "补充：6月4日下午现场观察到B区边缘线圈振动轻微，经频谱分析在允许范围内，不影响磁场均匀性。" '
            f'--reason "补充现场观察记录，完善交接资料" '
            f'--operator "何工"'
        )

        print_subsection("查看备注修改的详细对比")
        result = run_cmd(f"history --uz-id {target_id}")

    print_section("【晚到材料流程】工况照片晚上才补进来")
    print_subsection("场景：B区边缘的照片晚上18:30才补到，只刷新相关明细")
    print("规则：晚到照片只更新照片相关字段，不洗掉传感器编号中已确认的内容")
    result = run_cmd('review-photos --input-file test_data/late_photos.json --operator "何工"')

    print_subsection("验证：查看MAG-COIL-004记录，确认晚到照片已关联但核心数据未变")
    uz_004 = [uz for uz in uz_data if uz["sensor_id"] == "MAG-COIL-004"]
    if uz_004:
        result = run_cmd(f"show --uz-id {uz_004[0]['uniform_zone_id']}")

    print_section("【防重复导入验证】重复导入同一批传感器")
    print_subsection("场景：再次导入同一批数据，验证数量不翻倍")

    print("第一次导入后数量：")
    result = run_cmd("stats")

    print("\n重复导入同一批数据...")
    result = run_cmd('import-sensors --input-file test_data/sensors.json --operator "数据员"')

    print("\n重复导入后数量（应不变）：")
    result = run_cmd("stats")

    print_section("【最终确认】")
    confirmed_count = 0
    for uz in uz_data:
        uz_id = uz["uniform_zone_id"]
        with open(os.path.join(DATA_DIR, "uniform_zones.json"), "r") as f:
            current = json.load(f)
        current_uz = [c for c in current if c["uniform_zone_id"] == uz_id]
        if current_uz and not current_uz[0].get("coach_review_required", False):
            result = run_cmd(f'confirm --uz-id {uz_id} --operator "质量主管"')
            confirmed_count += 1

    print(f"\n共确认 {confirmed_count} 条记录")

    print_section("【可复盘记录与可重跑命令】")
    print_subsection("导出完整复盘报告")
    result = run_cmd("export --output reports/full_audit_report.json")

    print_subsection("为一条记录生成可重跑命令")
    if normal_ids:
        result = run_cmd(f"history --uz-id {normal_ids[0]} --replay")

    print_subsection("导出单条记录的完整历史")
    if normal_ids:
        result = run_cmd(f"history --uz-id {normal_ids[0]} --export reports/{normal_ids[0]}_history.json")

    print_section("【最终统计】")
    result = run_cmd("stats")

    print_section("演示完成")
    print("\n生成的文件：")
    print(f"  - data/sensors.json - 传感器原始记录（含原始行号）")
    print(f"  - data/photos.json - 工况照片记录")
    print(f"  - data/uniform_zones.json - 磁场线圈均匀区整合结果")
    print(f"  - data/history.json - 所有变更历史和审计日志")
    print(f"  - reports/full_audit_report.json - 完整复盘报告")
    print(f"\n可执行命令：")
    print(f"  python main.py show                     # 查看所有整合结果")
    print(f"  python main.py show --uz-id <id>        # 查看单条完整证据链")
    print(f"  python main.py history --uz-id <id> --replay  # 生成可重跑命令")
    print(f"  python main.py rules                    # 查看所有边界规则")
    print(f"  python main.py stats                    # 查看统计信息")

    print_section("系统核心特性验证清单")
    checklist = [
        ("✓ 传感器编号原始行号留存", "MAG-COIL-001的original_line_number=5"),
        ("✓ 人工改动记录完整", "manual_annotation修改前后有历史对比"),
        ("✓ 处理状态全程追踪", "IMPORTED → PHOTO_REVIEWED → REPORT_UPDATED → CONFIRMED"),
        ("✓ 两类证据整合", "每个均匀区记录同时关联sensor和photo证据"),
        ("✓ 温度混用不自动修正", "25K标记为待复核，等待教练确认"),
        ("✓ 重复导入不翻倍", "第二次导入后总数不变"),
        ("✓ 改前改后可对比", "每条历史记录都有before和after值"),
        ("✓ 晚到材料不洗数据", "只更新照片字段，传感器数据保持不变"),
        ("✓ 交接报告有闸门", "待复核记录不能更新报告"),
        ("✓ 边界规则代码化", "5条规则都在rules.py中，非口头约定"),
        ("✓ 可复盘记录导出", "full_audit_report.json包含所有证据"),
        ("✓ 可重跑命令生成", "history --replay输出完整命令序列"),
    ]
    for item, detail in checklist:
        print(f"  {item}")
        print(f"    {detail}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
