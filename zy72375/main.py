import argparse
import json
import sys
from datetime import datetime
from processor import UniformZoneProcessor


def cmd_import_sensors(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)

    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as f:
            sensor_data = json.load(f)
    else:
        sensor_data = [{
            "sensor_id": args.sensor_id,
            "original_line_number": args.line,
            "temperature_value": args.temp_value,
            "temperature_unit": args.temp_unit,
            "uniform_zone_flag": args.uniform_zone,
        }]

    result = processor.step1_import_sensors(
        sensor_data,
        source_file=args.source or args.input_file or "cli_input",
        operator=args.operator,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_review_photos(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)

    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as f:
            photo_data = json.load(f)
    else:
        photo_data = [{
            "photo_id": args.photo_id,
            "scene_description": args.description,
            "source_file": args.source,
            "related_sensor_ids": args.sensor_ids.split(",") if args.sensor_ids else [],
            "review_notes": args.notes,
            "is_late_arrival": args.late,
        }]

    result = processor.step2_review_photos(
        photo_data,
        operator=args.operator,
        input_file=args.input_file,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_update_report(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)

    uz_ids = args.uz_ids.split(",") if args.uz_ids else []
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            uz_ids = data.get("uniform_zone_ids", uz_ids)
            args.notes = data.get("report_notes", args.notes)

    result = processor.step3_update_report(
        uz_ids,
        report_notes=args.notes,
        operator=args.operator,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_coach_review(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    result = processor.coach_review_temperature(
        uniform_zone_id=args.uz_id,
        target_unit=args.target_unit,
        correction_mode=args.correction_mode,
        coach_remark=args.remark,
        operator=args.operator,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_manual_edit(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    result = processor.manual_edit(
        uniform_zone_id=args.uz_id,
        field_name=args.field,
        new_value=args.value,
        operator=args.operator,
        reason=args.reason,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_show(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    if args.uz_id:
        result = processor.get_combined_result(args.uz_id)
    else:
        result = processor.get_all_combined_results()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_export(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    output_path = processor.export_combined_report(args.output)
    print(f"报告已导出到: {output_path}")
    return 0


def cmd_stats(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    result = processor.get_statistics()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_history(args):
    from history import HistoryManager
    import os
    hm = HistoryManager(storage_path=os.path.join(args.data_dir, "history.json"))
    if args.uz_id:
        if args.compare_id:
            result = hm.compare_changes(args.compare_id)
        elif args.replay:
            result = hm.generate_replay_commands(args.uz_id)
            for line in result:
                print(line)
            return 0
        elif args.export:
            output = hm.export_history(args.uz_id, args.export)
            print(f"历史已导出到: {output}")
            return 0
        else:
            result = hm.get_uniform_zone_history(args.uz_id)
            result = [r.to_dict() for r in result]
    else:
        result = [r.to_dict() for r in hm.get_all_entries()]
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_confirm(args):
    processor = UniformZoneProcessor(data_dir=args.data_dir)
    result = processor.confirm_record(args.uz_id, args.operator)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_rules(args):
    from rules import BoundaryRuleEngine
    engine = BoundaryRuleEngine()
    print(json.dumps(engine.get_all_rules(), ensure_ascii=False, indent=2))
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="磁场线圈均匀区 - 可追溯数据管理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
标准三步法流程示例:
  1. 导入传感器编号:
     python3 main.py import-sensors --input-file sensors.json --operator 数据员

  2. 何工补看工况照片:
     python3 main.py review-photos --input-file photos.json --operator 何工

  3. 更新交接报告:
     python3 main.py update-report --uz-ids id1,id2 --notes "已完成现场核验" --operator 何工

温度单位混用处理:
  python3 main.py coach-review --uz-id <id> --target-unit °C --correction-mode fix_unit --remark "25K是记录错误，应为25°C" --operator "训练教练"
  python3 main.py coach-review --uz-id <id> --target-unit °C --correction-mode convert --remark "298.15K转换为25°C" --operator "训练教练"

查看可复盘记录:
  python3 main.py show --uz-id <id>
  python3 main.py history --uz-id <id> --replay
        """,
    )
    parser.add_argument("--data-dir", default="data", help="数据存储目录")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p = subparsers.add_parser("import-sensors", help="Step1: 导入传感器编号数据")
    p.add_argument("--input-file", help="传感器数据JSON文件")
    p.add_argument("--source", help="源文件标识")
    p.add_argument("--sensor-id", help="单条导入: 传感器编号")
    p.add_argument("--line", type=int, help="单条导入: 原始行号")
    p.add_argument("--temp-value", type=float, help="单条导入: 温度值")
    p.add_argument("--temp-unit", choices=["°C", "K"], help="单条导入: 温度单位")
    p.add_argument("--uniform-zone", type=bool, help="单条导入: 是否均匀区")
    p.add_argument("--operator", help="操作人")

    p = subparsers.add_parser("review-photos", help="Step2: 工况照片复核")
    p.add_argument("--input-file", help="照片数据JSON文件")
    p.add_argument("--photo-id", help="单条: 照片ID")
    p.add_argument("--description", help="单条: 场景描述")
    p.add_argument("--source", help="单条: 照片源文件")
    p.add_argument("--sensor-ids", help="单条: 关联传感器ID，逗号分隔")
    p.add_argument("--notes", help="单条: 复核备注")
    p.add_argument("--late", action="store_true", help="是否晚到材料")
    p.add_argument("--operator", default="何工", help="操作人(设备工程师)")

    p = subparsers.add_parser("update-report", help="Step3: 更新交接报告")
    p.add_argument("--input-file", help="报告数据JSON文件")
    p.add_argument("--uz-ids", help="均匀区记录ID，逗号分隔")
    p.add_argument("--notes", help="报告更新备注")
    p.add_argument("--operator", default="何工", help="操作人")

    p = subparsers.add_parser("coach-review", help="训练教练复核温度单位")
    p.add_argument("--uz-id", required=True, help="均匀区记录ID")
    p.add_argument("--target-unit", required=True, choices=["°C", "K"], help="修正后的目标单位")
    p.add_argument("--correction-mode", required=True, choices=["convert", "fix_unit"], help="修正模式: convert=按公式转换数值; fix_unit=仅修正单位标签，数值不变")
    p.add_argument("--remark", required=True, help="复核说明")
    p.add_argument("--operator", default="训练教练", help="操作人")

    p = subparsers.add_parser("manual-edit", help="人工改动字段")
    p.add_argument("--uz-id", required=True, help="均匀区记录ID")
    p.add_argument("--field", required=True, help="字段名")
    p.add_argument("--value", required=True, help="新值")
    p.add_argument("--reason", required=True, help="改动原因")
    p.add_argument("--operator", required=True, help="操作人")

    p = subparsers.add_parser("show", help="查看整合结果")
    p.add_argument("--uz-id", help="指定均匀区记录ID，不指定则查看全部")

    p = subparsers.add_parser("export", help="导出完整复盘报告")
    p.add_argument("--output", default="reports/combined_report.json", help="输出路径")

    p = subparsers.add_parser("stats", help="查看统计信息")

    p = subparsers.add_parser("history", help="查看历史记录")
    p.add_argument("--uz-id", help="指定均匀区记录ID")
    p.add_argument("--compare-id", help="指定历史条目ID查看详细对比")
    p.add_argument("--replay", action="store_true", help="生成可重跑命令")
    p.add_argument("--export", help="导出历史记录到文件")

    p = subparsers.add_parser("confirm", help="最终确认记录")
    p.add_argument("--uz-id", required=True, help="均匀区记录ID")
    p.add_argument("--operator", required=True, help="操作人")

    p = subparsers.add_parser("rules", help="查看所有边界规则")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    commands = {
        "import-sensors": cmd_import_sensors,
        "review-photos": cmd_review_photos,
        "update-report": cmd_update_report,
        "coach-review": cmd_coach_review,
        "manual-edit": cmd_manual_edit,
        "show": cmd_show,
        "export": cmd_export,
        "stats": cmd_stats,
        "history": cmd_history,
        "confirm": cmd_confirm,
        "rules": cmd_rules,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
