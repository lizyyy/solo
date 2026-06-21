from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .anomaly_queue import AnomalyQueue
from .demo_data import DirtyDemoDataset
from .history import QuestionHistoryStore
from .report import ReviewReportGenerator
from .replayer import PathReplayer, ReplayConfig
from .sort_stability import SortStabilityChecker


def cmd_run(args) -> int:
    work_dir = Path(args.work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    csv_path = Path(args.input).resolve()
    if not csv_path.exists():
        print(f"[错误] 输入文件不存在: {csv_path}", file=sys.stderr)
        return 2

    skip_patterns = args.skip if args.skip else ["IGNORE", "暂不处理"]
    config = ReplayConfig(
        param_version=args.param_version,
        skip_patterns=skip_patterns,
        strict_mode=args.strict,
    )
    replayer = PathReplayer(config=config)
    summary = replayer.replay_file(str(csv_path))

    store = QuestionHistoryStore(str(work_dir / "history_store"))
    for row in summary.break_down:
        if row.question:
            store.ingest(row.question)

    questions_for_sort = [r.question for r in summary.break_down if r.question]
    checker = SortStabilityChecker(key_func=lambda q: (q.sort_key,))
    if args.auto_tiebreak:
        checker.apply_tiebreak(questions_for_sort, field="question_id")
    detection = checker.check(questions_for_sort)
    summary.sort_detection = detection

    replayer.print_cli_report()

    if not args.no_history and questions_for_sort:
        print()
        for q in questions_for_sort:
            if q.remark.history or q.screenshots.history:
                store.print_history_report(q.question_id)

    if not args.no_ties and summary.sort_detection:
        print()
        checker.print_tie_groups(questions_for_sort)
        if detection.stable.value == "unstable":
            print()
            print("  [排序建议] " + detection.action_suggestion.splitlines()[0])

    queue_path = work_dir / "anomaly_queue.json"
    queue = AnomalyQueue(str(queue_path))
    added = queue.ingest_from_summary(summary)
    if added > 0:
        print(f"\n[异常队列] 新增 {added} 条异常 (存储: {queue_path})")
    queue.print_duty_dashboard()

    if added > 0 and args.demo_queue_ops:
        queue.mark_supplemented("A003", "weight=999999为压力测试上限，补充了权重约束文档", operator="duty-meng")
        queue.mark_rejudged("A002", "end=99999为题设合法上界，原越界判定改判通过", operator="lead")
        queue.mark_resolved("A005", "hard题已补充第三个参数 constraint=strict", operator="duty-meng")
        print("\n  [演示] 已对 A003 补充、A002 改判、A005 解决")
        queue.print_duty_dashboard()

    summary_json = work_dir / f"summary_{summary.param_version}.json"
    with open(summary_json, "w", encoding="utf-8") as f:
        f.write(summary.to_json())
    print(f"\n[结果] JSON摘要: {summary_json}")

    if not args.no_report:
        report_path = work_dir / f"review_report_{summary.param_version}.html"
        gen = ReviewReportGenerator(summary, store=store)
        gen.generate_html(str(report_path))
        print(f"[结果] 复核报告HTML: {report_path}")
        print(f"       （一页展示：参数版本+异常点+解释+题目历史，不用翻结论）")

    print("\n🎬 回放完成。从题目清单的任意行点 question_id 可调取历史，无需从头翻起。")
    return 0


def cmd_demo(args) -> int:
    work_dir = Path(args.work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    dataset = DirtyDemoDataset()
    dataset.describe()
    csv_path = work_dir / "demo_questions_dirty.csv"
    dataset.save(str(csv_path))
    print(f"[演示数据] 已生成脏数据CSV: {csv_path}")

    if args.auto_run:
        sys.argv = [
            sys.argv[0], "run",
            "--input", str(csv_path),
            "--work-dir", str(work_dir),
            "--param-version", "demo-v1.0-dirty",
            "--demo-queue-ops",
        ]
        return main()
    return 0


def _load_questions_from_csv(csv_path: str, skip_patterns=None):
    import csv as csv_mod
    if skip_patterns is None:
        skip_patterns = ["IGNORE", "暂不处理"]
    config = ReplayConfig(param_version="inspect", skip_patterns=skip_patterns)
    replayer = PathReplayer(config=config)
    summary = replayer.replay_file(csv_path)
    questions = [r.question for r in summary.break_down if r.question]
    return summary, questions


def cmd_inspect(args) -> int:
    csv_path = Path(args.input).resolve()
    if not csv_path.exists():
        print(f"[错误] 输入文件不存在: {csv_path}", file=sys.stderr)
        return 2

    skip_patterns = args.skip if args.skip else None
    summary, questions = _load_questions_from_csv(str(csv_path), skip_patterns=skip_patterns)
    checker = SortStabilityChecker(key_func=lambda q: (q.sort_key,))

    print(f"[inspect] 输入: {csv_path}")
    print(
        f"[inspect] 总行 {summary.total_rows} | 已处理 {summary.processed_rows} "
        f"| 跳过 {summary.skipped_rows} | 坏行 {summary.bad_rows}"
    )
    print()

    if args.show_ties:
        checker.print_tie_groups(questions)
        print()

    detection = checker.check(questions)
    print(f"[排序稳定性] {detection.stable.value}")
    if detection.diff_indices:
        print(f"[差异位置] {len(detection.diff_indices)} 处")
    print()
    print(detection.action_suggestion)
    return 0


def cmd_fix_sort(args) -> int:
    import csv as csv_mod

    csv_path = Path(args.input).resolve()
    if not csv_path.exists():
        print(f"[错误] 输入文件不存在: {csv_path}", file=sys.stderr)
        return 2

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv_mod.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if "sort_key" not in (fieldnames or []):
        print("[错误] CSV 中没有 sort_key 列", file=sys.stderr)
        return 2

    tiebreak_field = args.tiebreak
    if tiebreak_field not in (fieldnames or []):
        print(
            f"[提示] tiebreak 字段 '{tiebreak_field}' 不在 CSV 列中，回退用 question_id",
            file=sys.stderr,
        )
        tiebreak_field = "question_id"

    summary, questions = _load_questions_from_csv(str(csv_path))
    checker = SortStabilityChecker(key_func=lambda q: (q.sort_key,))

    print(f"[fix-sort] 输入: {csv_path}")
    checker.print_tie_groups(questions)

    ties = checker.find_tie_groups(questions)
    if not ties:
        print("\n[fix-sort] 未发现重复排序键，无需修复。")
        return 0

    qid_to_row: dict[str, dict] = {}
    for row in rows:
        qid = str(row.get("question_id", "")).strip()
        if qid:
            qid_to_row[qid] = row

    fixed_count = 0
    for _key, group in ties.items():
        for q in group:
            row = qid_to_row.get(q.question_id)
            if row is None:
                continue
            tb_value = str(row.get(tiebreak_field, q.question_id)).strip() or q.question_id
            original = str(row.get("sort_key", "")).strip()
            new_key = f"{original}#{tb_value}" if original else tb_value
            if new_key != original:
                row["sort_key"] = new_key
                fixed_count += 1

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv_mod.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n[fix-sort] 已为 {fixed_count} 行追加二级排序键 '{tiebreak_field}'")
    print(f"[fix-sort] 修复后CSV: {output_path}")

    summary2, questions2 = _load_questions_from_csv(str(output_path))
    detection = checker.check(questions2)
    print(f"[fix-sort] 修复后排序稳定性: {detection.stable.value}")
    if detection.stable.value == "unstable":
        print("[fix-sort] ⚠️  修复后仍不稳定，请检查是否有其他重复键")
    else:
        print("[fix-sort] ✅ 排序已稳定，可用修复后CSV重新运行回放")
    return 0


def cmd_history(args) -> int:
    work_dir = Path(args.work_dir).resolve()
    store = QuestionHistoryStore(str(work_dir / "history_store"))
    if args.question_id == "all":
        ids = store.all_ids()
        if not ids:
            print("[历史] 暂无记录，请先运行 replay。")
            return 0
        print(f"[历史] 共 {len(ids)} 道题: {', '.join(ids)}")
        for qid in ids:
            store.print_history_report(qid)
    else:
        store.print_history_report(args.question_id)
    return 0


def cmd_queue(args) -> int:
    work_dir = Path(args.work_dir).resolve()
    queue_path = work_dir / "anomaly_queue.json"
    queue = AnomalyQueue(str(queue_path))
    if args.action == "list":
        queue.print_duty_dashboard()
    elif args.action in {"supplement", "rejudge", "resolve"}:
        if not args.id or not args.detail:
            print("[错误] 需要提供 <ID> 和 <detail>", file=sys.stderr)
            return 2
        fn = {
            "supplement": queue.mark_supplemented,
            "rejudge": queue.mark_rejudged,
            "resolve": queue.mark_resolved,
        }[args.action]
        ok = fn(args.id, args.detail, operator=args.operator)
        if ok:
            print(f"[队列] 已对 {args.id} 执行 {args.action}: {args.detail}")
            queue.print_duty_dashboard()
        else:
            print(f"[错误] 未找到异常 {args.id}", file=sys.stderr)
            return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="graph-path-replay",
        description="图论路径参数回放 - 坏行/跳过/已处理分离统计 · 历史保留 · 排序稳定检测",
    )
    sub = p.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="运行回放流程")
    p_run.add_argument("--input", "-i", required=True, help="题目清单CSV路径")
    p_run.add_argument("--work-dir", "-w", default="./workspace", help="工作目录，存放历史、队列、报告")
    p_run.add_argument("--param-version", "-V", default="v1.0.0", help="参数版本号，写入报告与摘要")
    p_run.add_argument("--skip", action="append", help="跳过匹配关键词(可重复)")
    p_run.add_argument("--strict", action="store_true", help="严格模式：参数解析失败算坏行")
    p_run.add_argument("--auto-tiebreak", action="store_true", help="自动追加 id 作为排序 tiebreak")
    p_run.add_argument("--no-history", action="store_true", help="不打印题目历史摘要")
    p_run.add_argument("--no-ties", action="store_true", help="不打印排序冲突组")
    p_run.add_argument("--no-report", action="store_true", help="不生成HTML复核报告")
    p_run.add_argument("--demo-queue-ops", action="store_true", help="演示：自动对部分异常做补充/改判/解决")
    p_run.set_defaults(func=cmd_run)

    p_demo = sub.add_parser("demo", help="生成脏数据演示集，并可直接运行完整流程")
    p_demo.add_argument("--work-dir", "-w", default="./workspace", help="工作目录")
    p_demo.add_argument("--auto-run", "-r", action="store_true", help="生成后自动运行 replay")
    p_demo.set_defaults(func=cmd_demo)

    p_insp = sub.add_parser("inspect", help="检查清单的排序稳定性与重复 sort_key 组")
    p_insp.add_argument("--input", "-i", required=True, help="题目清单CSV路径")
    p_insp.add_argument("--show-ties", action="store_true", help="列出所有重复 sort_key 的题目组")
    p_insp.add_argument("--skip", action="append", help="跳过匹配关键词(可重复)，默认 IGNORE/暂不处理")
    p_insp.set_defaults(func=cmd_inspect)

    p_fix = sub.add_parser("fix-sort", help="追加二级排序键修复排序不稳定，输出修复后CSV")
    p_fix.add_argument("--input", "-i", required=True, help="题目清单CSV路径")
    p_fix.add_argument("--output", "-o", required=True, help="修复后CSV输出路径")
    p_fix.add_argument("--tiebreak", default="question_id", help="用作二级排序的字段(默认 question_id)")
    p_fix.set_defaults(func=cmd_fix_sort)

    p_hist = sub.add_parser("history", help="查看题目备注/截图历史")
    p_hist.add_argument("question_id", help="题目ID，或 all 查看全部")
    p_hist.add_argument("--work-dir", "-w", default="./workspace", help="工作目录")
    p_hist.set_defaults(func=cmd_history)

    p_q = sub.add_parser("queue", help="算法值班人异常队列")
    p_q.add_argument("action", choices=["list", "supplement", "rejudge", "resolve"], help="操作")
    p_q.add_argument("id", nargs="?", help="异常ID (如 A003)")
    p_q.add_argument("detail", nargs="?", help="操作说明")
    p_q.add_argument("--operator", "-o", default="duty", help="操作人")
    p_q.add_argument("--work-dir", "-w", default="./workspace", help="工作目录")
    p_q.set_defaults(func=cmd_queue)

    return p


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
