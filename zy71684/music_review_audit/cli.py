import argparse
import json
import os
import sys

from .importer import import_all
from .processor import Processor
from .risk import get_risk_summary, run_risk_scan
from .report import (
    export_csv_report,
    export_detail_csv,
    export_json_report,
    export_risk_csv,
    print_terminal_report,
)


def cmd_process(args):
    files_config = {}
    if args.reviews:
        files_config["reviews"] = args.reviews
    if args.tags:
        files_config["tags"] = args.tags
    if args.corrections:
        files_config["corrections"] = args.corrections
    if args.songs:
        files_config["songs"] = args.songs
    if args.reports:
        files_config["reports"] = args.reports

    if not files_config:
        print("错误: 至少需要提供一个输入文件，使用 --reviews/--tags/--corrections/--songs/--reports 指定")
        sys.exit(1)

    import_results = import_all(files_config)

    has_data = any(r.success_rows > 0 for r in import_results.values())
    if not has_data:
        print("错误: 所有文件导入均失败，无有效数据")
        for data_type, result in import_results.items():
            for err in result.errors:
                print(f"  [{data_type}] {err}")
        sys.exit(1)

    processor = Processor()
    processor.load_import_results(import_results)
    entries = processor.process()

    entries = run_risk_scan(entries)
    stats = processor.get_statistics()
    risk_summary = get_risk_summary(entries)

    print_terminal_report(
        entries=entries,
        stats=stats,
        risk_summary=risk_summary,
        import_results=import_results,
        dedup_log=processor.dedup_log,
    )

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)

        csv_path = os.path.join(args.output_dir, "复核总表.csv")
        export_csv_report(entries, csv_path)
        print(f"\n已导出复核总表: {csv_path}")

        json_path = os.path.join(args.output_dir, "复核报告.json")
        export_json_report(entries, stats, risk_summary, json_path)
        print(f"已导出JSON报告: {json_path}")

        detail_dir = os.path.join(args.output_dir, "按状态分类")
        export_detail_csv(entries, detail_dir)
        print(f"已导出分类明细: {detail_dir}/")

        risk_path = os.path.join(args.output_dir, "风险清单.csv")
        export_risk_csv(entries, risk_path)
        print(f"已导出风险清单: {risk_path}")


def cmd_import(args):
    files_config = {}
    if args.reviews:
        files_config["reviews"] = args.reviews
    if args.tags:
        files_config["tags"] = args.tags
    if args.corrections:
        files_config["corrections"] = args.corrections
    if args.songs:
        files_config["songs"] = args.songs
    if args.reports:
        files_config["reports"] = args.reports

    if not files_config:
        print("错误: 至少需要提供一个输入文件")
        sys.exit(1)

    import_results = import_all(files_config)

    for data_type, result in import_results.items():
        print(f"\n── {data_type} ──")
        print(f"  总行数: {result.total_rows}")
        print(f"  成功: {result.success_rows}")
        print(f"  跳过: {result.skipped_rows}")
        if result.errors:
            print(f"  错误/警告 ({len(result.errors)}条):")
            for err in result.errors[:10]:
                print(f"    · {err}")
            if len(result.errors) > 10:
                print(f"    ...还有{len(result.errors) - 10}条")

    if args.output:
        summary = {}
        for data_type, result in import_results.items():
            summary[data_type] = result.to_dict()
            summary[data_type]["records"] = [r.to_dict() for r in result.records]

        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"\n导入结果已保存: {args.output}")


def cmd_report(args):
    if not args.input:
        print("错误: 需要指定复核结果JSON文件 (--input)")
        sys.exit(1)

    if not os.path.isfile(args.input):
        print(f"错误: 文件不存在: {args.input}")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    from .models import AuditEntry

    entries = []
    raw_entries = data.get("entries", [])
    for raw in raw_entries:
        entry = AuditEntry(
            review_id=raw.get("review_id", ""),
            review_text=raw.get("review_text", ""),
            user_id=raw.get("user_id", ""),
            song_id=raw.get("song_id", ""),
            song_title=raw.get("song_title", ""),
            song_status=raw.get("song_status", ""),
            current_tag=raw.get("current_tag", ""),
            audit_status=raw.get("audit_status", ""),
            audit_note=raw.get("audit_note", ""),
        )
        entries.append(entry)

    stats = data.get("statistics", {})
    risk_summary = data.get("risk_summary", {})

    if args.format == "terminal" or not args.output_dir:
        print_terminal_report(
            entries=entries,
            stats=stats,
            risk_summary=risk_summary,
            import_results={},
            dedup_log=[],
        )

    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)

        csv_path = os.path.join(args.output_dir, "复核总表.csv")
        export_csv_report(entries, csv_path)
        print(f"已导出复核总表: {csv_path}")

        detail_dir = os.path.join(args.output_dir, "按状态分类")
        export_detail_csv(entries, detail_dir)
        print(f"已导出分类明细: {detail_dir}/")

        risk_path = os.path.join(args.output_dir, "风险清单.csv")
        export_risk_csv(entries, risk_path)
        print(f"已导出风险清单: {risk_path}")


def cmd_risk(args):
    files_config = {}
    if args.reviews:
        files_config["reviews"] = args.reviews
    if args.tags:
        files_config["tags"] = args.tags
    if args.corrections:
        files_config["corrections"] = args.corrections
    if args.songs:
        files_config["songs"] = args.songs
    if args.reports:
        files_config["reports"] = args.reports

    if not files_config:
        print("错误: 至少需要提供一个输入文件")
        sys.exit(1)

    import_results = import_all(files_config)

    processor = Processor()
    processor.load_import_results(import_results)
    entries = processor.process()
    entries = run_risk_scan(entries)
    risk_summary = get_risk_summary(entries)

    print("=" * 60)
    print("  风险快速扫描")
    print("=" * 60)
    print(f"\n  扫描条目: {len(entries)}")
    print(f"  发现风险: {risk_summary.get('total_risks', 0)}")
    print()

    for risk_type, count in risk_summary.get("by_type", {}).items():
        print(f"  · {risk_type}: {count}")
    for sev, count in risk_summary.get("by_severity", {}).items():
        print(f"  · {sev}级: {count}")

    risk_entries = [e for e in entries if e.risks]
    if risk_entries:
        print(f"\n{'─' * 60}")
        print(f"  风险明细 ({len(risk_entries)}条)")
        print(f"{'─' * 60}")
        for entry in risk_entries:
            print(f"\n  乐评ID: {entry.review_id}")
            print(f"  文本: {entry.review_text[:60]}...")
            print(f"  当前标签: {entry.current_tag} | 状态: {entry.audit_status}")
            for risk in entry.risks:
                sev_mark = {"高": "!!!", "中": "!!", "低": "!"}.get(risk.severity, "?")
                print(f"  [{sev_mark}] {risk.risk_type.value}: {risk.description}")
                if risk.evidence:
                    print(f"       证据: {risk.evidence[:80]}")
                if risk.source:
                    print(f"       来源: {risk.source}")
            if entry.source_traces:
                traces = [str(s) for s in entry.source_traces[:3]]
                print(f"  追溯: {' | '.join(traces)}")

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        export_risk_csv(entries, args.output)
        print(f"\n风险清单已导出: {args.output}")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="music-review-audit",
        description="乐评情绪标签复核工具 —— 讽刺误判、刷屏重复、下架歌曲风险检测与报告导出",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    process_parser = subparsers.add_parser("process", help="完整复核流程：导入→关联→去重→风险检测→报告")
    process_parser.add_argument("--reviews", help="乐评文本文件 (csv/json)")
    process_parser.add_argument("--tags", help="算法标签文件 (csv/json)")
    process_parser.add_argument("--corrections", help="人工修正文件 (csv/json)")
    process_parser.add_argument("--songs", help="歌曲信息文件 (csv/json)")
    process_parser.add_argument("--reports", help="举报记录文件 (csv/json)")
    process_parser.add_argument("--output-dir", help="报告输出目录")

    import_parser = subparsers.add_parser("import", help="仅导入数据，校验字段并预览")
    import_parser.add_argument("--reviews", help="乐评文本文件")
    import_parser.add_argument("--tags", help="算法标签文件")
    import_parser.add_argument("--corrections", help="人工修正文件")
    import_parser.add_argument("--songs", help="歌曲信息文件")
    import_parser.add_argument("--reports", help="举报记录文件")
    import_parser.add_argument("--output", help="导入结果JSON输出路径")

    report_parser = subparsers.add_parser("report", help="从已有JSON报告重新导出")
    report_parser.add_argument("--input", required=True, help="复核结果JSON文件")
    report_parser.add_argument("--output-dir", help="报告输出目录")
    report_parser.add_argument("--format", choices=["terminal", "csv", "json"], default="terminal", help="输出格式")

    risk_parser = subparsers.add_parser("risk", help="快速风险扫描")
    risk_parser.add_argument("--reviews", help="乐评文本文件")
    risk_parser.add_argument("--tags", help="算法标签文件")
    risk_parser.add_argument("--corrections", help="人工修正文件")
    risk_parser.add_argument("--songs", help="歌曲信息文件")
    risk_parser.add_argument("--reports", help="举报记录文件")
    risk_parser.add_argument("--output", help="风险清单CSV输出路径")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "process":
        cmd_process(args)
    elif args.command == "import":
        cmd_import(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "risk":
        cmd_risk(args)
