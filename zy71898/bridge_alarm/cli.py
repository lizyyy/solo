import argparse
import sys
import os
from datetime import datetime
from .storage import Database
from .service import AlarmService
from .export import ExportService
from .report import ReportService
from .models import RecordStatus, STATUS_DISPLAY


def get_default_operator():
    return os.environ.get("BRIDGE_OPERATOR", os.environ.get("USER", "unknown"))


def build_parser():
    parser = argparse.ArgumentParser(
        prog="bridge-alarm",
        description="桥梁位移报警管理工具 - 设备工程师专用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
常用命令:
  导入记录:  bridge-alarm import 振动班组记录.csv --source 班组A --operator 张工
  查看列表:  bridge-alarm list --status pending
  确认记录:  bridge-alarm confirm 1 --operator 张工 --remark 现场核实无误
  标记待补:  bridge-alarm supplement 2 --operator 张工 --reason 振动曲线缺失
  修正数值:  bridge-alarm revise 3 --field displacement --value 8.5 --operator 张工 --reason 读数有误
  撤回记录:  bridge-alarm withdraw 4 --operator 张工 --reason 误报
  查看详情:  bridge-alarm show 3
  筛选导出:  bridge-alarm export 导出.csv --status confirmed --start 2026-05-01
  生成报告:  bridge-alarm report 巡检报告.txt --start 2026-05-01 --operator 值班长
  看阈值档:  bridge-alarm thresholds
        """,
    )
    parser.add_argument("--db", default="bridge_alarm.db", help="数据库文件路径")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="从CSV导入记录")
    p_import.add_argument("file", help="CSV文件路径")
    p_import.add_argument("--source", required=True, help="数据来源(如: 班组A、监测系统)")
    p_import.add_argument("--operator", default=get_default_operator(), help="操作人")
    p_import.add_argument("--team", default="", help="班组")

    p_list = subparsers.add_parser("list", help="查看记录列表")
    p_list.add_argument("--status", choices=["pending", "confirmed", "supplement", "revised", "withdrawn", "all"],
                        default="pending", help="按状态筛选")
    p_list.add_argument("--source", help="按来源筛选")
    p_list.add_argument("--team", help="按班组筛选")
    p_list.add_argument("--bridge", help="按桥梁名称筛选")
    p_list.add_argument("--start", help="开始时间 (YYYY-MM-DD)")
    p_list.add_argument("--end", help="结束时间 (YYYY-MM-DD)")
    p_list.add_argument("--manual", action="store_true", help="只看人工改过的")

    p_show = subparsers.add_parser("show", help="查看记录详情及历史")
    p_show.add_argument("id", type=int, help="记录ID")

    p_confirm = subparsers.add_parser("confirm", help="确认记录")
    p_confirm.add_argument("id", type=int, help="记录ID")
    p_confirm.add_argument("--operator", default=get_default_operator(), help="操作人")
    p_confirm.add_argument("--remark", default="", help="备注")

    p_supplement = subparsers.add_parser("supplement", help="标记待补")
    p_supplement.add_argument("id", type=int, help="记录ID")
    p_supplement.add_argument("--operator", default=get_default_operator(), help="操作人")
    p_supplement.add_argument("--reason", required=True, help="待补原因")

    p_revise = subparsers.add_parser("revise", help="人工修正字段")
    p_revise.add_argument("id", type=int, help="记录ID")
    p_revise.add_argument("--field", required=True,
                         choices=["displacement", "threshold", "bridge_name", "position",
                                  "vibration_file", "remark", "team"],
                         help="要修改的字段")
    p_revise.add_argument("--value", required=True, help="新值")
    p_revise.add_argument("--operator", default=get_default_operator(), help="操作人")
    p_revise.add_argument("--reason", required=True, help="修正原因")

    p_withdraw = subparsers.add_parser("withdraw", help="撤回/作废记录")
    p_withdraw.add_argument("id", type=int, help="记录ID")
    p_withdraw.add_argument("--operator", default=get_default_operator(), help="操作人")
    p_withdraw.add_argument("--reason", required=True, help="撤回原因")

    p_export = subparsers.add_parser("export", help="筛选后导出CSV")
    p_export.add_argument("file", help="导出文件路径")
    p_export.add_argument("--status", help="按状态筛选")
    p_export.add_argument("--source", help="按来源筛选")
    p_export.add_argument("--team", help="按班组筛选")
    p_export.add_argument("--bridge", help="按桥梁名称筛选")
    p_export.add_argument("--start", help="开始时间 (YYYY-MM-DD)")
    p_export.add_argument("--end", help="结束时间 (YYYY-MM-DD)")
    p_export.add_argument("--manual", action="store_true", help="只导人工改过的")
    p_export.add_argument("--include-withdrawn", action="store_true", help="包含已撤回记录")

    p_report = subparsers.add_parser("report", help="生成值班长巡检报告")
    p_report.add_argument("file", help="报告文件路径")
    p_report.add_argument("--start", help="开始时间 (YYYY-MM-DD)")
    p_report.add_argument("--end", help="结束时间 (YYYY-MM-DD)")
    p_report.add_argument("--operator", default=get_default_operator(), help="生成人")

    subparsers.add_parser("thresholds", help="查看阈值跨档配置")

    p_stats = subparsers.add_parser("stats", help="查看统计信息")
    p_stats.add_argument("--start", help="开始时间 (YYYY-MM-DD)")
    p_stats.add_argument("--end", help="结束时间 (YYYY-MM-DD)")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    db = Database(args.db)
    service = AlarmService(db)
    export_svc = ExportService(db)
    report_svc = ReportService(db)

    if args.command == "import":
        result = service.import_from_csv(args.file, args.source, args.operator, args.team)
        print(f"导入完成: 成功{result.success}条, 重复{result.duplicate}条, 失败{len(result.failed)}条")
        if result.failed:
            print("失败明细:")
            for f in result.failed:
                print(f"  {f}")

    elif args.command == "list":
        filters = {}
        if args.status and args.status != "all":
            filters["status"] = args.status
        if args.source:
            filters["source"] = args.source
        if args.team:
            filters["team"] = args.team
        if args.bridge:
            filters["bridge_name"] = args.bridge
        if args.start:
            filters["start_time"] = args.start + " 00:00:00"
        if args.end:
            filters["end_time"] = args.end + " 23:59:59"
        if args.manual:
            filters["is_manual_modified"] = True

        records = service.query_records(filters)
        print(f"共 {len(records)} 条记录")
        print("-" * 100)
        print(f"{'ID':<5}{'编号':<12}{'桥梁':<10}{'位置':<10}{'位移':<8}{'等级':<8}"
              f"{'状态':<8}{'来源':<10}{'操作人':<10}{'报警时间':<20}")
        print("-" * 100)
        for r in records:
            print(f"{r['id']:<5}{r['record_no']:<12}{r['bridge_name']:<10}{r['position']:<10}"
                  f"{r['displacement']:<8.2f}{r['threshold_level']:<8}"
                  f"{r['status_display']:<8}{r['source']:<10}{r['operator']:<10}"
                  f"{r['alarm_time']:<20}")

    elif args.command == "show":
        detail = service.get_record_detail(args.id)
        if not detail:
            print(f"记录 {args.id} 不存在")
            sys.exit(1)
        r = detail["record"]
        print("=" * 70)
        print("记录详情")
        print("=" * 70)
        print(f"ID: {r['id']}  记录编号: {r['record_no']}  来源: {r['source']}")
        print(f"桥梁: {r['bridge_name']}  位置: {r['position']}  班组: {r['team']}")
        print(f"位移: {r['displacement']} mm  阈值: {r['threshold']} mm  等级: {r['threshold_level']}")
        print(f"状态: {r['status_display']}  待处理原因: {r['pending_reason']}")
        print(f"人工修改: {'是' if r['is_manual_modified'] else '否'}  最后操作人: {r['operator']}")
        print(f"振动文件: {r['vibration_file']}")
        print(f"备注: {r['remark']}")
        print(f"报警时间: {r['alarm_time']}")
        print(f"创建时间: {r['created_at']}  更新时间: {r['updated_at']}")
        print()
        print("操作历史:")
        print("-" * 70)
        print(f"{'时间':<20}{'操作':<10}{'原状态':<10}{'新状态':<10}"
              f"{'操作人':<10}{'原因/字段':<20}")
        print("-" * 70)
        for h in detail["history"]:
            action_map = {"import": "导入", "update": "更新", "status_change": "状态变更",
                         "field_edit": "字段修改", "withdraw": "撤回"}
            action = action_map.get(h["action"], h["action"])
            old_s = STATUS_DISPLAY[RecordStatus.from_str(h["old_status"])] if h["old_status"] else "-"
            new_s = STATUS_DISPLAY[RecordStatus.from_str(h["new_status"])] if h["new_status"] else "-"
            reason = h["field_name"] if h["field_name"] else h["reason"]
            print(f"{h['created_at']:<20}{action:<10}{old_s:<10}{new_s:<10}"
                  f"{h['operator']:<10}{reason:<20}")

    elif args.command == "confirm":
        if service.confirm_record(args.id, args.operator, args.remark):
            print(f"记录 {args.id} 已确认")
        else:
            print(f"确认失败: 记录不存在")

    elif args.command == "supplement":
        if service.mark_supplement(args.id, args.operator, args.reason):
            print(f"记录 {args.id} 已标记待补")
        else:
            print(f"操作失败: 记录不存在")

    elif args.command == "revise":
        try:
            if service.revise_record(args.id, args.field, args.value, args.operator, args.reason):
                print(f"记录 {args.id} 的 {args.field} 已修正为 {args.value}")
            else:
                print(f"修正失败: 记录不存在")
        except ValueError as e:
            print(f"参数错误: {e}")
            sys.exit(1)

    elif args.command == "withdraw":
        if service.withdraw_record(args.id, args.operator, args.reason):
            print(f"记录 {args.id} 已撤回")
        else:
            print(f"撤回失败: 记录不存在")

    elif args.command == "export":
        filters = {}
        if args.status:
            filters["status"] = args.status
        if args.source:
            filters["source"] = args.source
        if args.team:
            filters["team"] = args.team
        if args.bridge:
            filters["bridge_name"] = args.bridge
        if args.start:
            filters["start_time"] = args.start + " 00:00:00"
        if args.end:
            filters["end_time"] = args.end + " 23:59:59"
        if args.manual:
            filters["is_manual_modified"] = True

        result = export_svc.export_to_csv(args.file, filters, args.include_withdrawn)
        print(f"导出完成: {result['exported_count']} 条 -> {result['file_path']}")

    elif args.command == "report":
        result = report_svc.generate_patrol_report(
            args.file,
            start_time=args.start + " 00:00:00" if args.start else None,
            end_time=args.end + " 23:59:59" if args.end else None,
            operator=args.operator,
        )
        print(f"巡检报告已生成 -> {result['file_path']}")
        print(f"统计: 总数{result['total_count']} 已确认{result['confirmed_count']} "
              f"待补{result['supplement_count']} 人工改{result['revised_count']} "
              f"待处理{result['pending_count']}")

    elif args.command == "thresholds":
        thresholds = service.get_thresholds()
        print("阈值跨档配置:")
        print("-" * 50)
        print(f"{'等级':<10}{'最小值(mm)':<12}{'最大值(mm)':<12}{'说明':<20}")
        print("-" * 50)
        for t in thresholds:
            print(f"{t['level']:<10}{t['min_value']:<12}{t['max_value']:<12}{t['description']:<20}")

    elif args.command == "stats":
        filters = {}
        if args.start:
            filters["start_time"] = args.start + " 00:00:00"
        if args.end:
            filters["end_time"] = args.end + " 23:59:59"
        stats = service.get_statistics(filters)
        print(f"总数: {stats['total']}  人工改过: {stats['manual_modified']}")
        print("按状态:")
        for k, v in stats["by_status"].items():
            print(f"  {v['display']}: {v['count']}")
        if stats["by_source"]:
            print("按来源:")
            for k, v in stats["by_source"].items():
                print(f"  {k}: {v}")
        if stats["by_level"]:
            print("按阈值等级:")
            for k, v in stats["by_level"].items():
                print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
