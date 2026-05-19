
#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime

from models import init_db, get_session, ReviewResult
from services import QualityCheckSystem


def init_system():
    engine = init_db()
    session = get_session(engine)
    return QualityCheckSystem(session)


def cmd_import(args):
    system = init_system()

    with open(args.input, 'r', encoding='utf-8') as f:
        data = json.load(f)

    batch, result = system.import_service.import_transcripts(
        file_name=args.input,
        transcripts_data=data,
        created_by=args.user or "cli",
        skip_duplicates=not args.force
    )

    print(f"批次号: {batch.batch_no}")
    print(f"状态: {batch.status}")
    print(f"成功: {batch.success_count}")
    print(f"失败: {batch.failed_count}")

    if result.errors:
        print("\n错误:")
        for err in result.errors:
            print(f"  - {err}")

    if result.failed:
        print("\n失败记录:")
        for fail in result.failed:
            print(f"  索引{fail['index']}: {fail['reason']}")


def cmd_scan(args):
    system = init_system()

    if args.transcript_id:
        transcript, results = system.scan_service.scan_transcript(
            args.transcript_id,
            force_rescan=args.force
        )
        if transcript:
            print(f"转录ID: {transcript.transcript_id}")
            print(f"是否有问题: {transcript.has_issues}")
            print(f"问题数量: {len(results)}")
            for r in results:
                print(f"  - {r.rule_code}: {r.reason} (动作: {r.action})")
        else:
            print("未找到指定的转录记录")
    else:
        scan_batch, result = system.scan_service.scan_batch(
            created_by=args.user or "cli",
            force_rescan=args.force
        )
        print(f"扫描批次: {scan_batch.batch_no}")
        print(f"总数: {scan_batch.total_transcripts}")
        print(f"成功: {scan_batch.success_count}")
        print(f"失败: {scan_batch.failed_count}")

        if scan_batch.error_details:
            print("\n错误详情:")
            for err in scan_batch.error_details[:10]:
                print(f"  - {err}")


def cmd_review(args):
    system = init_system()

    if args.issue_id:
        result = system.review_service.get_issue_review(
            scan_result_id=args.issue_id,
            is_resolved=args.resolved,
            resolved_by=args.user or "cli",
            comment=args.comment
        )
        if result:
            print(f"问题ID {args.issue_id} 已更新为已解决: {args.resolved}")
        else:
            print("未找到指定的问题记录")
    elif args.transcript_id:
        result = system.review_service.review_transcript(
            transcript_id=args.transcript_id,
            review_result=args.result,
            reviewed_by=args.user or "cli",
            comment=args.comment
        )
        if result:
            print(f"转录 {args.transcript_id} 复核结果已更新: {args.result}")
        else:
            print("未找到指定的转录记录")
    elif args.batch:
        try:
            ids = json.loads(args.batch)
        except:
            with open(args.batch, 'r') as f:
                ids = json.load(f)

        result = system.review_service.batch_review(
            transcript_ids=ids,
            review_result=args.result,
            reviewed_by=args.user or "cli"
        )
        print(f"批量复核完成: 成功 {len(result.success_ids)}, 失败 {len(result.failed)}")


def cmd_summary(args):
    system = init_system()

    if args.transcript_id:
        summary = system.summary_service.get_transcript_summary(args.transcript_id)
        if summary:
            print(json.dumps(summary, indent=2, ensure_ascii=False))
        else:
            print("未找到指定的转录记录")
    else:
        start_date = None
        end_date = None

        if args.start_date:
            start_date = datetime.fromisoformat(args.start_date)
        if args.end_date:
            end_date = datetime.fromisoformat(args.end_date)

        summary = system.summary_service.get_batch_summary(
            start_date=start_date,
            end_date=end_date,
            agent_id=args.agent_id
        )
        print(json.dumps(summary, indent=2, ensure_ascii=False))


def cmd_export(args):
    system = init_system()

    filters = {}
    if args.has_issues is not None:
        filters["has_issues"] = args.has_issues
    if args.review_status:
        filters["review_status"] = args.review_status
    if args.agent_id:
        filters["agent_id"] = args.agent_id

    if args.format == "csv":
        export_no, content = system.export_service.export_to_csv(
            filters=filters,
            created_by=args.user or "cli"
        )
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"导出成功: {args.output}")
        else:
            print(f"导出编号: {export_no}")
            print(content)
    elif args.format == "json":
        export_no, data = system.export_service.export_issues_to_json(
            transcript_id=args.transcript_id,
            created_by=args.user or "cli"
        )
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"导出成功: {args.output}")
        else:
            print(f"导出编号: {export_no}")
            print(json.dumps(data, indent=2, ensure_ascii=False))


def cmd_show(args):
    system = init_system()

    details = system.get_transcript_with_details(args.transcript_id)
    if details:
        print(json.dumps(details, indent=2, ensure_ascii=False))
    else:
        print("未找到指定的转录记录")


def cmd_rescan(args):
    system = init_system()

    transcript_ids = None
    if args.ids:
        try:
            transcript_ids = json.loads(args.ids)
        except:
            with open(args.ids, 'r') as f:
                transcript_ids = json.load(f)

    scan_batch, result = system.scan_service.rescan_with_new_rules(
        transcript_ids=transcript_ids,
        created_by=args.user or "cli"
    )

    print(f"重新扫描批次: {scan_batch.batch_no}")
    print(f"总数: {scan_batch.total_transcripts}")
    print(f"成功: {scan_batch.success_count}")
    print(f"失败: {scan_batch.failed_count}")


def main():
    parser = argparse.ArgumentParser(description="客服质检系统 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入转录数据")
    import_parser.add_argument("input", help="输入JSON文件路径")
    import_parser.add_argument("--user", help="操作用户")
    import_parser.add_argument("--force", action="store_true", help="覆盖已存在的记录")

    scan_parser = subparsers.add_parser("scan", help="扫描质检")
    scan_parser.add_argument("--transcript-id", help="指定转录ID扫描")
    scan_parser.add_argument("--user", help="操作用户")
    scan_parser.add_argument("--force", action="store_true", help="强制重新扫描")

    rescan_parser = subparsers.add_parser("rescan", help="规则更新后重新扫描")
    rescan_parser.add_argument("--ids", help="转录ID列表(JSON或文件)")
    rescan_parser.add_argument("--user", help="操作用户")

    review_parser = subparsers.add_parser("review", help="人工复核")
    review_group = review_parser.add_mutually_exclusive_group(required=True)
    review_group.add_argument("--issue-id", type=int, help="问题ID")
    review_group.add_argument("--transcript-id", help="转录ID")
    review_group.add_argument("--batch", help="批量转录ID列表(JSON或文件)")
    review_parser.add_argument("--result", choices=[r.value for r in ReviewResult],
                               default=ReviewResult.CONFIRMED.value, help="复核结果")
    review_parser.add_argument("--resolved", action="store_true", help="是否已解决")
    review_parser.add_argument("--comment", help="复核备注")
    review_parser.add_argument("--user", help="操作用户")

    summary_parser = subparsers.add_parser("summary", help="汇总统计")
    summary_parser.add_argument("--transcript-id", help="指定转录ID")
    summary_parser.add_argument("--start-date", help="开始日期 (ISO格式)")
    summary_parser.add_argument("--end-date", help="结束日期 (ISO格式)")
    summary_parser.add_argument("--agent-id", help="坐席ID")

    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--format", choices=["csv", "json"], default="csv", help="导出格式")
    export_parser.add_argument("--output", help="输出文件路径")
    export_parser.add_argument("--transcript-id", help="指定转录ID (仅JSON格式)")
    export_parser.add_argument("--has-issues", type=bool, help="是否仅导出有问题的记录")
    export_parser.add_argument("--review-status", help="复核状态筛选")
    export_parser.add_argument("--agent-id", help="坐席ID筛选")
    export_parser.add_argument("--user", help="操作用户")

    show_parser = subparsers.add_parser("show", help="显示转录详情")
    show_parser.add_argument("transcript_id", help="转录ID")

    args = parser.parse_args()

    if args.command == "import":
        cmd_import(args)
    elif args.command == "scan":
        cmd_scan(args)
    elif args.command == "rescan":
        cmd_rescan(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "summary":
        cmd_summary(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "show":
        cmd_show(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
