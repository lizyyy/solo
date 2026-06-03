#!/usr/bin/env python3

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from warehouse_heat_zone.models import (
    CoordinateOrigin,
    Shelf,
    PhotoRecord,
    AlertLabel,
    AlertSeverity,
    RecordStatus,
)
from warehouse_heat_zone.processor import HeatZoneProcessor


def print_step(step_num, title):
    print(f"\n{'='*60}")
    print(f"【第{step_num}步】{title}")
    print("-" * 60)


def print_section(title):
    print(f"\n{'='*60}")
    print(f">>> {title}")
    print("-" * 60)


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print("\n" + "#"*60)
    print("#  仓储货架承重热区 - 完整复现流程")
    print("#"*60)
    print("\n场景说明:")
    print("  施工经理晚上催结果，培训教官老梁只能翻坐标原点说明")
    print("  但移动端截图挡住了告警标签，让结论不敢直接发")
    print("  补录巡检照片编号后安全距离报告要跟着变")
    print("\n三步核心流程:")
    print("  1. 坐标原点说明第一次导入")
    print("  2. 培训教官老梁补看巡检照片编号")
    print("  3. 安全距离报告更新")

    print_section("清理旧数据，准备重新开始")
    os.system("rm -rf ./data/records ./data/reports")
    print("✓ 数据目录已清理")

    processor = HeatZoneProcessor(data_dir="./data")

    print_step(1, "导入坐标原点说明")
    origin = CoordinateOrigin(
        origin_id="origin_warehouse_a",
        name="A区仓库原点",
        x=0.0,
        y=0.0,
        z=0.0,
        description="A区仓库西南角立柱基准点",
    )
    processor.import_coordinate_origin(origin)
    print(f"✓ 坐标原点导入: {origin.name}")
    print(f"  ID: {origin.origin_id}")
    print(f"  坐标: ({origin.x}, {origin.y}, {origin.z})")

    print_step(2, "添加三个货架")
    shelves_data = [
        ("A-01", 10.0, 5.0, 1000.0, 400.0, "低负载，预期顺利处理"),
        ("A-02", 15.0, 8.0, 1200.0, 900.0, "高负载，截图遮挡告警标签"),
        ("A-03", 20.0, 12.0, 800.0, 700.0, "中负载，后续补录旧口径"),
    ]
    for code, x, y, max_load, cur_load, desc in shelves_data:
        shelf = Shelf(
            shelf_id=f"shelf_{code}",
            code=code,
            location_x=x,
            location_y=y,
            max_load=max_load,
            current_load=cur_load,
            origin_id="origin_warehouse_a",
        )
        processor.add_shelf(shelf)
        print(f"✓ 货架 {code}: {cur_load}/{max_load} kg ({desc})")

    print_step(3, "创建巡检批次")
    batch_id = "BATCH-20260603-001"
    processor.create_new_batch(batch_id)
    print(f"✓ 批次创建: {batch_id}")

    print_step(4, "处理三条巡检记录（三种不同情况）")

    print("\n  记录1: 顺利处理 - A-01货架")
    record1 = processor.process_record(
        shelf_code="A-01",
        origin_id="origin_warehouse_a",
        photo_number="P20260603_001",
    )
    print(f"    ✓ 记录ID: {record1.record_id}")
    print(f"    状态: {record1.status.value}")
    print(f"    安全距离: {record1.heat_zones[0].safe_distance}m")

    print("\n  记录2: 移动端截图挡住了告警标签 - A-02货架")
    print("    ⚠  检测到遮挡后，状态设为 need_review，留待施工经理复核")
    photo_blocked = PhotoRecord(
        photo_id="photo_A02_001",
        photo_number="P20260603_002",
        is_mobile_screenshot=True,
        screenshot_bbox=(100, 50, 200, 150),
        labels=[
            AlertLabel(
                label_id="alert_A02_01",
                position_x=80,
                position_y=60,
                width=60,
                height=30,
                severity=AlertSeverity.HIGH,
                message="承重接近上限",
            )
        ],
    )
    record2 = processor.process_record(
        shelf_code="A-02",
        origin_id="origin_warehouse_a",
        photo=photo_blocked,
    )
    print(f"    ✓ 记录ID: {record2.record_id}")
    print(f"    状态: {record2.status.value} (施工经理复核中)")
    print(f"    安全距离: {record2.heat_zones[0].safe_distance}m")
    print(f"    关键细节: 告警标签被移动端截图遮挡 → 不急着归正常，留给施工经理复核")

    print("\n  记录3: 后续补录旧口径数据 - A-03货架")
    record3 = processor.process_record(
        shelf_code="A-03",
        origin_id="origin_warehouse_a",
    )
    print(f"    ✓ 记录ID: {record3.record_id}")
    print(f"    初始状态: {record3.status.value}")

    print_section("查看当前所有记录")
    records = processor.get_all_records()
    for r in records:
        print(f"  {r.shelf_code}: {r.status.value} (安全距离: {r.heat_zones[0].safe_distance}m)")

    print_step(5, "培训教官老梁补看巡检照片编号")
    print("老梁翻查历史档案，发现A-03有旧口径记录...")
    record3_updated = processor.supplement_photo_number(
        record_id=record3.record_id,
        photo_number="OLD-P20251215-087",
        old_calibration=True,
    )
    print(f"  ✓ 照片编号: {record3_updated.photo_number}")
    print(f"  新状态: {record3_updated.status.value}")
    print(f"  说明: 从历史巡检照片编号补来的旧口径数据")

    print_step(6, "施工经理复核与人工修正")
    print("施工经理仔细检查截图遮挡区域，确认实际无异常...")
    record2_corrected = processor.manual_correct(
        record_id=record2.record_id,
        new_status=RecordStatus.NORMAL,
        note="施工经理复核：移动端截图边缘遮挡告警标签区域，经核查该区域实际承重正常，确认无误",
    )
    print(f"  ✓ 人工修正完成")
    print(f"  新状态: {record2_corrected.status.value}")
    print(f"  修正说明: {record2_corrected.correction_note}")

    print_step(7, "重跑分析，更新计算结果")
    record2_rerun = processor.rerun_record(record2.record_id)
    print(f"  ✓ 重跑完成 (第{record2_rerun.run_count}次)")
    print(f"  安全距离: {record2_rerun.heat_zones[0].safe_distance}m")

    print_step(8, "生成最终安全距离报告")
    report = processor.generate_safety_report(batch_id)
    print(f"  报告ID: {report.report_id}")
    print(f"  总记录数: {report.total_records}")
    print(f"    - 正常: {report.normal_count}")
    print(f"    - 待复核: {report.need_review_count}")
    print(f"    - 旧口径: {report.old_calibration_count}")
    print(f"  安全距离统计:")
    print(f"    - 最小: {report.min_safe_distance}m")
    print(f"    - 平均: {report.avg_safe_distance:.2f}m")
    print(f"    - 最大: {report.max_safe_distance}m")

    print_section("最终记录列表")
    records = processor.get_all_records()
    for r in records:
        status_icon = {
            "normal": "✓",
            "need_review": "⚠",
            "old_calibration": "📜",
            "pending": "○",
        }.get(r.status.value, "?")
        photo_info = f", 照片: {r.photo_number}" if r.photo_number else ""
        correction_info = f", 人工修正" if r.is_manual_correction else ""
        rerun_info = f", 重跑{r.run_count}次" if r.run_count > 1 else ""
        print(f"  {status_icon} {r.shelf_code}: {r.status.value} (安全距离: {r.heat_zones[0].safe_distance}m{photo_info}{correction_info}{rerun_info})")

    print("\n" + "#"*60)
    print("#  复盘总结")
    print("#"*60)
    print("\n三种处理结果对比:")
    print("  1. A-01: 顺利处理 → 状态 normal，安全距离 0.8m")
    print("  2. A-02: 移动端截图遮挡 → 先 need_review，人工复核后 normal")
    print("  3. A-03: 补录旧口径照片编号 → 状态 old_calibration")
    print("\n关键细节验证:")
    print("  ✓ 坐标原点说明第一次导入成功")
    print("  ✓ 移动端截图挡住告警标签时，不急着归正常，留给施工经理复核")
    print("  ✓ 培训教官老梁补看巡检照片编号")
    print("  ✓ 补录后安全距离报告随之更新")
    print("  ✓ 有一次人工修正和一次重跑记录")
    print("\n可重跑命令:")
    print("  完整复现: python3 run_demo.py")
    print("  查看列表: python3 -m warehouse_heat_zone list")
    print("  生成报告: python3 -m warehouse_heat_zone report --batch-id BATCH-20260603-001")
    print("  小看板: python3 -m warehouse_heat_zone.dashboard")
    print()


if __name__ == "__main__":
    main()
