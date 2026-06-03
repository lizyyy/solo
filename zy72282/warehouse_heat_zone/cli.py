import argparse
import json
import sys
from datetime import datetime
from .models import (
    CoordinateOrigin,
    Shelf,
    PhotoRecord,
    AlertLabel,
    AlertSeverity,
    RecordStatus,
)
from .processor import HeatZoneProcessor


def main():
    parser = argparse.ArgumentParser(description="仓储货架承重热区分析系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import-origin", help="导入坐标原点说明")
    import_parser.add_argument("--file", required=True, help="坐标原点JSON文件路径")
    import_parser.add_argument("--data-dir", default="./data", help="数据目录")

    add_shelf_parser = subparsers.add_parser("add-shelf", help="添加货架信息")
    add_shelf_parser.add_argument("--code", required=True, help="货架编号")
    add_shelf_parser.add_argument("--x", type=float, required=True, help="X坐标")
    add_shelf_parser.add_argument("--y", type=float, required=True, help="Y坐标")
    add_shelf_parser.add_argument("--max-load", type=float, required=True, help="最大承重")
    add_shelf_parser.add_argument("--current-load", type=float, required=True, help="当前承重")
    add_shelf_parser.add_argument("--origin-id", required=True, help="坐标原点ID")
    add_shelf_parser.add_argument("--data-dir", default="./data", help="数据目录")

    batch_parser = subparsers.add_parser("new-batch", help="创建新批次")
    batch_parser.add_argument("--batch-id", required=True, help="批次ID")
    batch_parser.add_argument("--data-dir", default="./data", help="数据目录")

    process_parser = subparsers.add_parser("process", help="处理巡检记录")
    process_parser.add_argument("--shelf-code", required=True, help="货架编号")
    process_parser.add_argument("--origin-id", required=True, help="坐标原点ID")
    process_parser.add_argument("--photo-number", help="照片编号")
    process_parser.add_argument("--mobile-blocked", action="store_true", help="是否有移动端截图遮挡")
    process_parser.add_argument("--data-dir", default="./data", help="数据目录")

    supplement_parser = subparsers.add_parser("supplement", help="补录巡检照片编号")
    supplement_parser.add_argument("--record-id", required=True, help="记录ID")
    supplement_parser.add_argument("--photo-number", required=True, help="照片编号")
    supplement_parser.add_argument("--old-calibration", action="store_true", help="是否为旧口径数据")
    supplement_parser.add_argument("--data-dir", default="./data", help="数据目录")

    correct_parser = subparsers.add_parser("correct", help="人工修正记录状态")
    correct_parser.add_argument("--record-id", required=True, help="记录ID")
    correct_parser.add_argument("--status", required=True, choices=["normal", "need_review", "completed", "old_calibration"], help="新状态")
    correct_parser.add_argument("--note", required=True, help="修正说明")
    correct_parser.add_argument("--data-dir", default="./data", help="数据目录")

    rerun_parser = subparsers.add_parser("rerun", help="重跑分析")
    rerun_parser.add_argument("--record-id", required=True, help="记录ID")
    rerun_parser.add_argument("--data-dir", default="./data", help="数据目录")

    report_parser = subparsers.add_parser("report", help="生成安全距离报告")
    report_parser.add_argument("--batch-id", required=True, help="批次ID")
    report_parser.add_argument("--data-dir", default="./data", help="数据目录")

    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")
    demo_parser.add_argument("--data-dir", default="./data", help="数据目录")

    list_parser = subparsers.add_parser("list", help="列出所有记录")
    list_parser.add_argument("--data-dir", default="./data", help="数据目录")

    args = parser.parse_args()

    if args.command == "import-origin":
        cmd_import_origin(args)
    elif args.command == "add-shelf":
        cmd_add_shelf(args)
    elif args.command == "new-batch":
        cmd_new_batch(args)
    elif args.command == "process":
        cmd_process(args)
    elif args.command == "supplement":
        cmd_supplement(args)
    elif args.command == "correct":
        cmd_correct(args)
    elif args.command == "rerun":
        cmd_rerun(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "demo":
        cmd_demo(args)
    elif args.command == "list":
        cmd_list(args)
    else:
        parser.print_help()


def cmd_import_origin(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    origin_id = processor.import_coordinate_origin_from_file(args.file)
    print(f"✓ 坐标原点已导入: {origin_id}")


def cmd_add_shelf(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    shelf = Shelf(
        shelf_id=f"shelf_{args.code}",
        code=args.code,
        location_x=args.x,
        location_y=args.y,
        max_load=args.max_load,
        current_load=args.current_load,
        origin_id=args.origin_id,
    )
    processor.add_shelf(shelf)
    print(f"✓ 货架已添加: {args.code}")


def cmd_new_batch(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    processor.create_new_batch(args.batch_id)
    print(f"✓ 新批次已创建: {args.batch_id}")


def cmd_process(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    photo = None
    if args.mobile_blocked:
        photo = PhotoRecord(
            photo_id=f"photo_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            photo_number=args.photo_number or "",
            is_mobile_screenshot=True,
            screenshot_bbox=(100, 50, 200, 150),
            labels=[
                AlertLabel(
                    label_id="label_1",
                    position_x=80,
                    position_y=60,
                    width=60,
                    height=30,
                    severity=AlertSeverity.HIGH,
                    message="承重告警",
                )
            ],
        )

    record = processor.process_record(
        shelf_code=args.shelf_code,
        origin_id=args.origin_id,
        photo=photo,
        photo_number=args.photo_number,
    )
    print(f"✓ 记录已处理: {record.record_id}")
    print(f"  状态: {record.status.value}")
    print(f"  安全距离: {record.heat_zones[0].safe_distance}m")


def cmd_supplement(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    record = processor.supplement_photo_number(
        record_id=args.record_id,
        photo_number=args.photo_number,
        old_calibration=args.old_calibration,
    )
    print(f"✓ 照片编号已补录: {args.photo_number}")
    print(f"  新状态: {record.status.value}")


def cmd_correct(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    status_map = {
        "normal": RecordStatus.NORMAL,
        "need_review": RecordStatus.NEED_REVIEW,
        "completed": RecordStatus.COMPLETED,
        "old_calibration": RecordStatus.OLD_CALIBRATION,
    }
    record = processor.manual_correct(
        record_id=args.record_id,
        new_status=status_map[args.status],
        note=args.note,
    )
    print(f"✓ 记录已人工修正")
    print(f"  新状态: {record.status.value}")
    print(f"  修正说明: {record.correction_note}")


def cmd_rerun(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    record = processor.rerun_record(args.record_id)
    print(f"✓ 记录已重跑 (第{record.run_count}次)")


def cmd_report(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    report = processor.generate_safety_report(args.batch_id)
    print(f"\n{'='*50}")
    print(f"安全距离报告: {report.report_id}")
    print(f"{'='*50}")
    print(f"批次ID: {report.batch_id}")
    print(f"生成时间: {report.generated_at}")
    print(f"总记录数: {report.total_records}")
    print(f"  - 正常: {report.normal_count}")
    print(f"  - 待复核: {report.need_review_count}")
    print(f"  - 旧口径: {report.old_calibration_count}")
    print(f"\n安全距离统计:")
    print(f"  - 最小: {report.min_safe_distance}m")
    print(f"  - 平均: {report.avg_safe_distance:.2f}m")
    print(f"  - 最大: {report.max_safe_distance}m")
    print(f"{'='*50}\n")


def cmd_list(args):
    processor = HeatZoneProcessor(data_dir=args.data_dir)
    records = processor.get_all_records()
    print(f"\n共 {len(records)} 条记录:\n")
    for r in records:
        print(f"ID: {r.record_id}")
        print(f"  货架: {r.shelf_code}, 状态: {r.status.value}")
        print(f"  照片编号: {r.photo_number}, 重跑次数: {r.run_count}")
        if r.heat_zones:
            print(f"  安全距离: {r.heat_zones[0].safe_distance}m")
        print()


def cmd_demo(args):
    print("\n" + "="*60)
    print("仓储货架承重热区 - 完整演示流程")
    print("="*60)

    processor = HeatZoneProcessor(data_dir=args.data_dir)

    print("\n【第1步】导入坐标原点说明")
    print("-" * 40)
    origin = CoordinateOrigin(
        origin_id="origin_warehouse_a",
        name="A区仓库原点",
        x=0.0,
        y=0.0,
        z=0.0,
        description="A区仓库西南角立柱基准点",
    )
    processor.import_coordinate_origin(origin)
    print(f"✓ 坐标原点导入: {origin.name} ({origin.origin_id})")
    print(f"  坐标: ({origin.x}, {origin.y}, {origin.z})")

    print("\n【第2步】添加三个货架")
    print("-" * 40)
    shelves_data = [
        ("A-01", 10.0, 5.0, 1000.0, 400.0, "origin_warehouse_a"),
        ("A-02", 15.0, 8.0, 1200.0, 900.0, "origin_warehouse_a"),
        ("A-03", 20.0, 12.0, 800.0, 700.0, "origin_warehouse_a"),
    ]
    for code, x, y, max_load, cur_load, origin_id in shelves_data:
        shelf = Shelf(
            shelf_id=f"shelf_{code}",
            code=code,
            location_x=x,
            location_y=y,
            max_load=max_load,
            current_load=cur_load,
            origin_id=origin_id,
        )
        processor.add_shelf(shelf)
        print(f"✓ 货架 {code}: 承重 {cur_load}/{max_load} kg")

    print("\n【第3步】创建巡检批次")
    print("-" * 40)
    batch_id = "batch_20260603_demo"
    processor.create_new_batch(batch_id)
    print(f"✓ 批次创建: {batch_id}")

    print("\n【第4步】处理三条巡检记录（三种不同情况）")
    print("-" * 40)

    print("\n  记录1: 顺利处理 (A-01货架)")
    record1 = processor.process_record(
        shelf_code="A-01",
        origin_id="origin_warehouse_a",
        photo_number="P20260603_001",
    )
    print(f"    ✓ 记录ID: {record1.record_id}")
    print(f"    状态: {record1.status.value}")
    print(f"    安全距离: {record1.heat_zones[0].safe_distance}m")

    print("\n  记录2: 移动端截图遮挡告警标签 (A-02货架)")
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
    print(f"    ⚠ 告警标签被移动端截图遮挡，暂不归为正常")

    print("\n  记录3: 从巡检照片编号补录旧口径数据 (A-03货架)")
    record3 = processor.process_record(
        shelf_code="A-03",
        origin_id="origin_warehouse_a",
    )
    print(f"    ✓ 记录ID: {record3.record_id}")
    print(f"    初始状态: {record3.status.value}")

    print("\n【第5步】培训教官老梁补看巡检照片编号")
    print("-" * 40)
    print(f"  补录记录3的照片编号，标记为旧口径数据")
    record3_updated = processor.supplement_photo_number(
        record_id=record3.record_id,
        photo_number="OLD_P20251215_087",
        old_calibration=True,
    )
    print(f"    ✓ 照片编号: {record3_updated.photo_number}")
    print(f"    新状态: {record3_updated.status.value}")

    print("\n【第6步】人工修正与重跑")
    print("-" * 40)
    print(f"  施工经理复核记录2，确认无问题")
    record2_corrected = processor.manual_correct(
        record_id=record2.record_id,
        new_status=RecordStatus.NORMAL,
        note="施工经理复核：截图遮挡区域实际无异常，确认正常",
    )
    print(f"    ✓ 人工修正完成")
    print(f"    新状态: {record2_corrected.status.value}")
    print(f"    修正说明: {record2_corrected.correction_note}")

    print(f"\n  重跑记录2，更新计算结果")
    record2_rerun = processor.rerun_record(record2.record_id)
    print(f"    ✓ 重跑完成 (第{record2_rerun.run_count}次)")

    print("\n【第7步】生成安全距离报告")
    print("-" * 40)
    report = processor.generate_safety_report(batch_id)
    print(f"  报告ID: {report.report_id}")
    print(f"  总记录数: {report.total_records}")
    print(f"    - 正常: {report.normal_count}")
    print(f"    - 待复核: {report.need_review_count}")
    print(f"    - 旧口径: {report.old_calibration_count}")
    print(f"  平均安全距离: {report.avg_safe_distance:.2f}m")

    print("\n" + "="*60)
    print("演示完成！所有数据已保存到 ./data 目录")
    print("="*60)
    print("\n复盘命令:")
    print(f"  查看记录列表: python -m warehouse_heat_zone list")
    print(f"  重新生成报告: python -m warehouse_heat_zone report --batch-id {batch_id}")
    print(f"  重跑某条记录: python -m warehouse_heat_zone rerun --record-id {record1.record_id}")
    print()


if __name__ == "__main__":
    main()
