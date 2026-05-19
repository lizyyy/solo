#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime, date
from pprint import pprint

from app.utils.storage import DataStorage
from app.services import DataImporter, FaultClassifier, FaultQuery, ReportExporter


def main():
    parser = argparse.ArgumentParser(description="换电运营故障分类系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument("--json", help="设备事件JSON文件路径")
    import_parser.add_argument("--csv", help="客服工单CSV文件路径")

    classify_parser = subparsers.add_parser("classify", help="执行故障分类")

    query_parser = subparsers.add_parser("query", help="查询故障")
    query_parser.add_argument("--assignee", help="按负责人筛选")
    query_parser.add_argument("--status", help="按状态筛选")
    query_parser.add_argument("--type", help="按故障类型筛选")
    query_parser.add_argument("--station", help="按换电站筛选")
    query_parser.add_argument("--start-date", help="开始日期 (YYYY-MM-DD)")
    query_parser.add_argument("--end-date", help="结束日期 (YYYY-MM-DD)")

    status_parser = subparsers.add_parser("status", help="更新故障状态")
    status_parser.add_argument("fault_id", help="故障ID")
    status_parser.add_argument("action", choices=["confirm", "resolve", "dismiss"], help="操作")
    status_parser.add_argument("--notes", help="备注信息")

    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("--format", choices=["csv", "xlsx"], default="csv", help="导出格式")
    export_parser.add_argument("--output", help="输出文件名")

    summary_parser = subparsers.add_parser("summary", help="查看统计汇总")

    bad_records_parser = subparsers.add_parser("bad-records", help="查看坏记录")

    run_parser = subparsers.add_parser("run", help="一键执行完整流程")
    run_parser.add_argument("--json", required=True, help="设备事件JSON文件路径")
    run_parser.add_argument("--csv", required=True, help="客服工单CSV文件路径")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    storage = DataStorage()
    importer = DataImporter(storage)
    classifier = FaultClassifier(storage)
    query = FaultQuery(storage)
    reporter = ReportExporter(storage)

    if args.command == "import":
        if args.json:
            success, failed, bad_records = importer.import_device_events_json(args.json)
            print(f"设备事件导入完成: 成功 {success} 条, 失败 {failed} 条")
            if bad_records:
                print(f"产生 {len(bad_records)} 条坏记录")
        if args.csv:
            success, failed, bad_records = importer.import_customer_service_csv(args.csv)
            print(f"客服工单导入完成: 成功 {success} 条, 失败 {failed} 条")
            if bad_records:
                print(f"产生 {len(bad_records)} 条坏记录")

    elif args.command == "classify":
        event_count, ticket_count = classifier.classify_all()
        print(f"故障分类完成: 设备事件 {event_count} 条, 客服工单 {ticket_count} 条")

    elif args.command == "query":
        start_date = date.fromisoformat(args.start_date) if args.start_date else None
        end_date = date.fromisoformat(args.end_date) if args.end_date else None

        faults = query.filter_faults(
            assignee=args.assignee,
            start_date=start_date,
            end_date=end_date,
            status=args.status,
            fault_type=args.type,
            station_id=args.station,
        )

        print(f"查询结果: 共 {len(faults)} 条")
        for f in faults[:10]:
            print(
                f"  [{f.fault_id}] {f.fault_description} - {f.status} - {f.event_time.strftime('%Y-%m-%d %H:%M')}"
            )
        if len(faults) > 10:
            print(f"  ... 还有 {len(faults) - 10} 条")

    elif args.command == "status":
        if args.action == "confirm":
            result = query.confirm_fault(args.fault_id, args.notes)
        elif args.action == "resolve":
            result = query.resolve_fault(args.fault_id, args.notes)
        elif args.action == "dismiss":
            result = query.dismiss_fault(args.fault_id, args.notes)

        if result:
            print(f"故障 {args.fault_id} 已{args.action}")
        else:
            print(f"未找到故障 {args.fault_id}")

    elif args.command == "export":
        faults = query.filter_faults()
        bad_records = storage.load_all_bad_records()

        if args.format == "csv":
            path = reporter.export_faults_to_csv(faults, args.output)
            print(f"报告已导出到: {path}")
            bad_path = reporter.export_bad_records_to_csv(bad_records)
            print(f"坏记录已导出到: {bad_path}")
        else:
            path = reporter.export_summary_to_excel(faults, bad_records, args.output)
            print(f"完整报告已导出到: {path}")

    elif args.command == "summary":
        summary = query.get_summary()
        print("=" * 50)
        print("统计汇总")
        print("=" * 50)
        print(f"故障总数: {summary['total']}")
        print(f"待审核: {summary['pending_review']}")
        print(f"已确认: {summary['confirmed']}")
        print(f"已解决: {summary['resolved']}")
        print()
        print("按故障类型:")
        for ftype, count in summary["by_type"].items():
            print(f"  {ftype}: {count}")
        print()
        print("按负责人:")
        for assignee, count in summary["by_assignee"].items():
            print(f"  {assignee}: {count}")

    elif args.command == "bad-records":
        bad_summary = query.get_bad_records_summary()
        print(f"坏记录总数: {bad_summary['total']}")
        print()
        for br in bad_summary["records"]:
            print(f"[{br.bad_record_id}] {br.source}: {br.error_message[:60]}...")

    elif args.command == "run":
        print("=" * 60)
        print("开始执行完整流程")
        print("=" * 60)

        print("\n[1/4] 导入数据...")
        success1, failed1, bad1 = importer.import_device_events_json(args.json)
        print(f"  设备事件: 成功 {success1} 条, 失败 {failed1} 条")
        success2, failed2, bad2 = importer.import_customer_service_csv(args.csv)
        print(f"  客服工单: 成功 {success2} 条, 失败 {failed2} 条")

        print("\n[2/4] 自动分类...")
        event_count, ticket_count = classifier.classify_all()
        print(f"  分类完成: 设备事件 {event_count} 条, 客服工单 {ticket_count} 条")

        print("\n[3/4] 统计汇总...")
        summary = query.get_summary()
        print(f"  故障总数: {summary['total']}")
        print(f"  待审核: {summary['pending_review']}")
        print(f"  高置信度: {summary['high_confidence']}")

        print("\n[4/4] 导出报告...")
        faults = query.filter_faults()
        bad_records = storage.load_all_bad_records()
        path = reporter.export_summary_to_excel(faults, bad_records)
        print(f"  报告已导出: {path}")

        print("\n" + "=" * 60)
        print("流程执行完成！")
        print("=" * 60)


if __name__ == "__main__":
    main()
