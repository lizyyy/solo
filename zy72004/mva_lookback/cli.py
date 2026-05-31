import argparse
import json
import os
import sys

from .engine import LookbackEngine


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="mva-lookback",
        description="并购估值假设回看 — 帮阿宁理清重复认款和例外项",
    )
    sub = parser.add_subparsers(dest="command")

    run_parser = sub.add_parser("run", help="跑一回并购估值假设回看")
    run_parser.add_argument("data_path", help="CSV 文件或目录路径")
    run_parser.add_argument(
        "--store-dir", default=None, help="持久化存储目录（默认 .mva_store）"
    )
    run_parser.add_argument(
        "--output-dir", default=None, help="报告输出目录（默认 output）"
    )
    run_parser.add_argument(
        "--priority",
        nargs="*",
        default=[],
        help="数据源优先级，如 --priority payment_收款流水.csv approval_审批邮件.csv",
    )

    verify_parser = sub.add_parser("verify", help="重启后校验数据一致性")
    verify_parser.add_argument(
        "--store-dir", default=None, help="持久化存储目录（默认 .mva_store）"
    )
    verify_parser.add_argument(
        "--output-dir", default=None, help="报告输出目录（默认 output）"
    )

    note_parser = sub.add_parser("note", help="给某条记录加备注")
    note_parser.add_argument("record_id", help="记录 ID")
    note_parser.add_argument("content", help="备注内容")
    note_parser.add_argument("--author", default="阿宁", help="备注人")
    note_parser.add_argument(
        "--store-dir", default=None, help="持久化存储目录（默认 .mva_store）"
    )

    query_parser = sub.add_parser("query", help="查一条记录的详情")
    query_parser.add_argument("record_id", help="记录 ID")
    query_parser.add_argument("--data-path", default=None, help="如果还没加载过数据，提供数据路径")
    query_parser.add_argument(
        "--store-dir", default=None, help="持久化存储目录（默认 .mva_store）"
    )
    query_parser.add_argument(
        "--output-dir", default=None, help="报告输出目录（默认 output）"
    )

    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "run":
        return _cmd_run(args)
    elif args.command == "verify":
        return _cmd_verify(args)
    elif args.command == "note":
        return _cmd_note(args)
    elif args.command == "query":
        return _cmd_query(args)

    return 0


def _cmd_run(args):
    engine = LookbackEngine(store_dir=args.store_dir, output_dir=args.output_dir)

    print("正在加载数据…")
    load_result = engine.load_data(args.data_path)
    if not load_result["success"]:
        print(f"❌ 加载失败：{load_result['message']}")
        return 1

    print(f"加载完成：{load_result['record_count']} 条记录，{load_result['attachment_count']} 个附件")
    if load_result.get("load_errors"):
        print(f"⚠ 有 {len(load_result['load_errors'])} 条加载错误：")
        for err in load_result["load_errors"][:5]:
            print(f"  文件 {err['file']} 第 {err['row']} 行: {err['error']}")

    print("正在跑并购估值假设回看…")
    result = engine.run(source_priority=args.priority)

    engine.print_summary(result)

    report_path = engine.save_detail_report(result)
    print(f"\n📄 财务明细报告已保存：{report_path}")

    return 0


def _cmd_verify(args):
    engine = LookbackEngine(store_dir=args.store_dir, output_dir=args.output_dir)
    verify_result = engine.verify_integrity()

    integrity = verify_result["integrity"]
    print("=" * 48)
    print("  并购估值假设回看 · 一致性校验")
    print("=" * 48)
    print(f"  历史运行次数：{integrity['result_count']}")
    print(f"  历史备注数：{integrity['note_count']}")
    print(f"  判断变更数：{integrity['change_count']}")
    print(f"  最近一次运行：{integrity['latest_run'] or '无'}")

    if integrity["orphan_note_count"] > 0:
        print(f"\n  ⚠ 有 {integrity['orphan_note_count']} 条孤立备注")
    else:
        print("\n  ✅ 重启后数据一致，历史备注和导出数字对得上")

    print(f"\n📄 校验报告：{verify_result['report_path']}")
    print("=" * 48)

    return 0


def _cmd_note(args):
    engine = LookbackEngine(store_dir=args.store_dir)
    path = engine.add_note(args.record_id, args.content, args.author)
    print(f"✅ 备注已保存：{path}")
    return 0


def _cmd_query(args):
    engine = LookbackEngine(store_dir=args.store_dir, output_dir=args.output_dir)

    if args.data_path:
        engine.load_data(args.data_path)
        engine.run()

    result = engine.query_record(args.record_id)

    if result["record"] is None and not result["notes"]:
        print(f"找不到记录 {args.record_id}，也没有相关备注。")
        return 1

    print("=" * 48)
    print(f"  记录详情：{args.record_id}")
    print("=" * 48)

    if result["record"]:
        r = result["record"]
        print(f"  类型：{r.record_type.value}")
        print(f"  金额：{r.amount}")
        print(f"  日期：{r.date}")
        print(f"  批次：{r.batch_id}")
        print(f"  来源：{r.source_file}")
        print(f"  描述：{r.description}")

    if result["notes"]:
        print("\n  备注：")
        for n in result["notes"]:
            print(f"    [{n['written_at']}] {n['author']}：{n['note']}")

    if result["conflicts"]:
        print("\n  关联冲突：")
        for c in result["conflicts"]:
            print(f"    {c.conflict_id} [{c.conflict_type.value}]")
            print(f"    建议：{c.suggested_action[:60]}…")

    if result["judgment_changes"]:
        print("\n  判断变更：")
        for ch in result["judgment_changes"]:
            print(f"    {ch.old_judgment} → {ch.new_judgment}")
            print(f"    原因：{ch.change_reason[:60]}…")

    print("=" * 48)
    return 0


if __name__ == "__main__":
    sys.exit(main())
