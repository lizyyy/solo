import argparse
import sys
import os

from .engine import ReplayEngine
from .data_loader import (
    load_formulas,
    load_unit_conversions,
    load_history_answers,
    load_input_rows,
    load_attachments,
    load_notes,
)
from .report import ReportGenerator
from .__init__ import __version__


def print_banner():
    print("=" * 60)
    print("  约束规划参数回放工具 v" + __version__)
    print("=" * 60)
    print()


def print_summary(summary):
    print("【处理统计】")
    print(f"  总计:       {summary.total} 行")
    print(f"  已处理:     {summary.processed} 行")
    print(f"  坏行:       {summary.bad} 行")
    print(f"  跳过行:     {summary.skipped} 行")
    print(f"  排序不稳定: {summary.sort_unstable} 行")
    print()

    print("【影响统计】")
    print(f"  受晚到附件影响: {summary.affected_by_attachment} 行")
    print(f"  受口头备注影响: {summary.affected_by_note} 行")
    print(f"  受旧版答案影响: {summary.affected_by_old_history} 行")
    print(f"  有单位换算:     {summary.has_unit_conversion} 行")
    print()

    if summary.by_source:
        print("【按来源分布】")
        for src, cnt in sorted(summary.by_source.items()):
            print(f"  {src}: {cnt} 行")
        print()


def cmd_replay(args):
    print_banner()

    data_dir = args.data_dir or "data"
    formula_dir = args.formula_dir or os.path.join(data_dir, "formulas")
    history_dir = args.history_dir or os.path.join(data_dir, "history")
    attach_dir = args.attach_dir or os.path.join(data_dir, "attachments")
    notes_dir = args.notes_dir or os.path.join(data_dir, "notes")
    unit_file = args.unit_file or os.path.join(data_dir, "unit_conversions.json")
    output_dir = args.output_dir or "output"

    print(f"加载公式目录: {formula_dir}")
    formulas = load_formulas(formula_dir)
    print(f"  已加载 {len(formulas)} 个公式")

    print(f"加载单位换算: {unit_file}")
    unit_convs = load_unit_conversions(unit_file)
    print(f"  已加载 {len(unit_convs)} 条单位换算规则")

    print(f"加载历史答案: {history_dir}")
    history = load_history_answers(history_dir)
    print(f"  已加载 {len(history)} 条历史答案")

    print(f"加载晚到附件: {attach_dir}")
    attachments = load_attachments(attach_dir)
    print(f"  已加载 {len(attachments)} 个附件")

    print(f"加载口头备注: {notes_dir}")
    notes = load_notes(notes_dir)
    print(f"  已加载 {len(notes)} 条备注")
    print()

    if not os.path.exists(args.input):
        print(f"错误: 输入文件不存在: {args.input}")
        sys.exit(1)

    print(f"读取输入数据: {args.input}")
    input_rows = load_input_rows(args.input)
    print(f"  共 {len(input_rows)} 行")
    print()

    engine = ReplayEngine(param_version=args.param_version)
    engine.load_formulas(formulas)
    engine.load_unit_conversions(unit_convs)
    engine.load_history_answers(history)

    attach_files = [f for f in os.listdir(attach_dir) if os.path.isfile(os.path.join(attach_dir, f))] if os.path.exists(attach_dir) else []
    engine.load_attachments(attachments, attach_files)

    notes_files = [f for f in os.listdir(notes_dir) if os.path.isfile(os.path.join(notes_dir, f))] if os.path.exists(notes_dir) else []
    engine.load_notes(notes, notes_files)

    judgment_file = os.path.join(output_dir, "judgment_changes.jsonl")
    if os.path.exists(judgment_file):
        engine.load_judgment_changes(judgment_file)
        print(f"已加载历史判断调整记录: {judgment_file}")
        print()

    if args.sort_reference:
        ref_rows = load_input_rows(args.sort_reference)
        ref_order = [r.get("id", f"row_{i}") for i, r in enumerate(ref_rows)]
        engine.set_sort_reference(ref_order)
        print(f"已加载排序参考: {args.sort_reference} ({len(ref_order)} 条)")
        print()

    report = engine.process_rows(input_rows, target_unit=args.target_unit)

    print_summary(report.summary)

    if report.bad_rows:
        print("【坏行】")
        for row in report.bad_rows:
            print(f"  - {row.row_id}: {row.error_msg}")
        print()

    if report.skipped_rows:
        print("【跳过行】")
        for row in report.skipped_rows:
            print(f"  - {row.row_id}: {row.skip_reason}")
        print()

    if report.sort_unstable_rows:
        print("【排序不稳定（单独拎出）】")
        for row in report.sort_unstable_rows:
            print(f"  - {row.row_id}: {row.sort_unstable_reason}")
        print()

    if report.abnormal_points:
        print("【异常点】")
        for ab in report.abnormal_points:
            print(f"  - [{ab['type']}] {ab['row_id']}: {ab['detail']}")
        print()

    if report.unit_mismatch_notes:
        print("【单位换算提示】")
        for note in report.unit_mismatch_notes:
            print(f"  - {note}")
        print()

    if report.judgment_changes:
        print("【判断调整记录】")
        for j in report.judgment_changes:
            print(f"  [{j.timestamp}] {j.operator}")
            print(f"    旧判断: {j.old_judgment}")
            print(f"    新判断: {j.new_judgment}")
            print(f"    说明:   {j.reason}")
        print()

    affected_rows = [r for r in report.rows if r.status.value in ("processed", "sort_unstable") and (
        r.affected_by_attachment or r.affected_by_note or r.affected_by_old_history
    )]
    if affected_rows:
        print("【受影响记录明细】")
        for row in affected_rows:
            print(f"  - {row.row_id}: {row.value} {row.unit}")
            print(f"    解释: {row.explanation}")
            if row.value_diff and "无变化" not in row.value_diff:
                print(f"    变化: {row.value_diff}")
            if row.affected_by_attachment:
                print(f"    影响类型: 受晚到附件影响")
            if row.affected_by_note:
                print(f"    影响类型: 受口头备注影响")
            if row.affected_by_old_history:
                print(f"    影响类型: 使用历史旧版答案")
            if row.source_details:
                for sd in row.source_details:
                    if sd.source_type.value in ("attachment_late", "verbal_note", "history_old"):
                        affect_type = []
                        if sd.affects_value:
                            affect_type.append("改值")
                        if sd.affects_judgment:
                            affect_type.append("改判断")
                        if not affect_type:
                            affect_type.append("仅说明")
                        tag = "、".join(affect_type)
                        file_info = f" [文件: {sd.file_name}]" if sd.file_name else ""
                        print(f"    · [{sd.source_type.label}, {tag}]{file_info}")
                        print(f"      摘要: {sd.content_summary}")
                        if sd.impact_description:
                            print(f"      影响: {sd.impact_description}")
        print()

    generator = ReportGenerator(output_dir=output_dir)
    txt_path, json_path = generator.save_report(report)

    print("报告已生成:")
    print(f"  文本报告: {txt_path}")
    print(f"  JSON报告: {json_path}")
    print()
    print("一页式复核报告包含: 参数版本 | 统计概览 | 异常点 | 单位说明 | 排序问题 | 判断调整")
    print()


def cmd_judge(args):
    print_banner()

    output_dir = args.output_dir or "output"
    generator = ReportGenerator(output_dir=output_dir)

    filepath = generator.save_judgment_change(
        row_id=args.row_id,
        old_judgment=args.old,
        new_judgment=args.new,
        reason=args.reason,
        operator=args.operator or "",
    )

    print(f"判断调整已记录: {filepath}")
    print(f"  行ID:     {args.row_id}")
    print(f"  旧判断:   {args.old}")
    print(f"  新判断:   {args.new}")
    print(f"  说明:     {args.reason}")
    if args.operator:
        print(f"  操作人:   {args.operator}")
    print()


def cmd_list(args):
    print_banner()

    data_dir = args.data_dir or "data"
    formula_dir = args.formula_dir or os.path.join(data_dir, "formulas")
    history_dir = args.history_dir or os.path.join(data_dir, "history")

    formulas = load_formulas(formula_dir)
    print(f"公式列表 ({len(formulas)} 个):")
    for f in formulas:
        print(f"  - {f.name} (版本: {f.version}, 单位: {f.unit})")
    print()

    history = load_history_answers(history_dir)
    print(f"历史答案 ({len(history)} 条):")
    for h in history[:10]:
        print(f"  - {h.id}: {h.content} {h.unit} [{h.source.label}]")
    if len(history) > 10:
        print(f"  ... 共 {len(history)} 条")
    print()


def cmd_help(args):
    print_banner()
    print("使用说明:")
    print()
    print("1. 回放参数:")
    print("   python -m constraint_param_replay replay -i input.json")
    print("   python -m constraint_param_replay replay -i data.csv --param-version v2")
    print()
    print("2. 记录判断调整:")
    print("   python -m constraint_param_replay judge --row-id row_1 --old 合格 --new 不合格 --reason 复核发现异常")
    print()
    print("3. 查看已加载的数据:")
    print("   python -m constraint_param_replay list")
    print()
    print("常用选项:")
    print("  --data-dir       数据目录 (默认: data/)")
    print("  --output-dir     输出目录 (默认: output/)")
    print("  --param-version  参数版本号 (默认: v1)")
    print("  --target-unit    目标单位 (自动换算)")
    print()
    print("数据目录结构:")
    print("  data/")
    print("    formulas/          公式定义 (.json)")
    print("    history/           历史答案 (.json)")
    print("    attachments/       晚到附件")
    print("    notes/             口头备注 (.txt)")
    print("    unit_conversions.json  单位换算规则")
    print()


def main():
    parser = argparse.ArgumentParser(
        prog="constraint-param-replay",
        description="约束规划参数回放工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    replay_parser = subparsers.add_parser("replay", help="执行参数回放")
    replay_parser.add_argument("-i", "--input", required=True, help="输入文件路径 (JSON 或 CSV)")
    replay_parser.add_argument("--data-dir", help="数据根目录")
    replay_parser.add_argument("--formula-dir", help="公式目录")
    replay_parser.add_argument("--history-dir", help="历史答案目录")
    replay_parser.add_argument("--attach-dir", help="附件目录")
    replay_parser.add_argument("--notes-dir", help="备注目录")
    replay_parser.add_argument("--unit-file", help="单位换算文件")
    replay_parser.add_argument("--output-dir", help="输出目录")
    replay_parser.add_argument("--param-version", default="v1", help="参数版本号")
    replay_parser.add_argument("--target-unit", help="目标单位")
    replay_parser.add_argument("--sort-reference", help="排序参考文件")

    judge_parser = subparsers.add_parser("judge", help="记录判断调整")
    judge_parser.add_argument("--row-id", required=True, help="行ID")
    judge_parser.add_argument("--old", required=True, help="旧判断")
    judge_parser.add_argument("--new", required=True, help="新判断")
    judge_parser.add_argument("--reason", required=True, help="调整原因")
    judge_parser.add_argument("--operator", help="操作人")
    judge_parser.add_argument("--output-dir", help="输出目录")

    list_parser = subparsers.add_parser("list", help="列出可用数据")
    list_parser.add_argument("--data-dir", help="数据目录")
    list_parser.add_argument("--formula-dir", help="公式目录")
    list_parser.add_argument("--history-dir", help="历史答案目录")

    help_parser = subparsers.add_parser("help", help="显示帮助")

    args = parser.parse_args()

    if args.command == "replay":
        cmd_replay(args)
    elif args.command == "judge":
        cmd_judge(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "help" or args.command is None:
        cmd_help(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
