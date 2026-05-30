from __future__ import annotations

import argparse
import json
import sys
from typing import List, Optional

from .state import AppState, FilterState
from .models import DataSource
from .loader import DataLoader
from .validator import DataValidator
from .optimizer import ScheduleOptimizer
from .conflicts import ConflictDetector
from .audit import AuditTrail
from .renderer import TerminalRenderer
from .exporter import Exporter


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rehearsal_optimizer",
        description="音乐排练时长优化工具 — 按曲目难度、声部缺勤和演出日期安排练习顺序",
    )
    sub = parser.add_subparsers(dest="command", help="可用命令")

    p_load = sub.add_parser("load", help="加载数据文件")
    p_load.add_argument("--pieces-csv", help="曲目 CSV 文件路径")
    p_load.add_argument("--pieces-json", help="曲目 JSON 文件路径")
    p_load.add_argument("--sections-json", help="声部 JSON 文件路径")
    p_load.add_argument("--absences-csv", help="缺勤 CSV 文件路径")
    p_load.add_argument("--absences-json", help="缺勤 JSON 文件路径")
    p_load.add_argument("--performances-json", help="演出 JSON 文件路径")
    p_load.add_argument("--reports-json", help="排练报告 JSON 文件路径")
    p_load.add_argument("--source", choices=["system", "manual"], default="system", help="数据来源标记")

    p_schedule = sub.add_parser("schedule", help="生成优化排练方案")
    p_schedule.add_argument("--total-minutes", type=float, required=True, help="可用排练总时长（分钟）")
    p_schedule.add_argument("--reference-date", help="参考日期（YYYY-MM-DD），默认今天")
    p_schedule.add_argument("--difficulty-weight", type=float, default=0.4, help="难度权重（默认 0.4）")
    p_schedule.add_argument("--absence-weight", type=float, default=0.35, help="缺勤权重（默认 0.35）")
    p_schedule.add_argument("--urgency-weight", type=float, default=0.25, help="紧迫度权重（默认 0.25）")

    p_conflicts = sub.add_parser("conflicts", help="检测冲突（按类型拆分显示）")
    p_conflicts.add_argument("--type", choices=["absence_duplicate", "difficulty_inversion", "time_overrun", "all"], default="all", help="冲突类型")
    p_conflicts.add_argument("--total-minutes", type=float, default=0, help="可用排练总时长（检测时间超排需要）")
    p_conflicts.add_argument("--summary-only", action="store_true", help="仅显示统计")

    p_compare = sub.add_parser("compare", help="对比历史排练方案")

    p_audit = sub.add_parser("audit", help="查看审计日志")
    p_audit.add_argument("--action", help="按动作类型筛选")
    p_audit.add_argument("--detail", type=int, help="查看指定索引的审计详情")
    p_audit.add_argument("--diff", nargs=2, type=int, metavar=("A", "B"), help="对比两条审计记录")

    p_undo = sub.add_parser("undo", help="撤回最近一次排练方案")

    p_recalc = sub.add_parser("recalculate", help="基于当前数据重新计算排练方案")
    p_recalc.add_argument("--total-minutes", type=float, required=True, help="可用排练总时长（分钟）")
    p_recalc.add_argument("--reference-date", help="参考日期（YYYY-MM-DD）")

    p_supplement = sub.add_parser("supplement", help="手动补录数据")
    p_supplement.add_argument("--piece-name", help="补录曲目名称")
    p_supplement.add_argument("--piece-duration", type=float, default=0, help="补录曲目时长（分钟）")
    p_supplement.add_argument("--piece-difficulty", type=float, default=5.0, help="补录曲目难度（1-10）")
    p_supplement.add_argument("--absence-person", help="补录缺勤人名")
    p_supplement.add_argument("--absence-section", help="补录缺勤声部 ID")
    p_supplement.add_argument("--absence-date", help="补录缺勤日期（YYYY-MM-DD）")
    p_supplement.add_argument("--perf-piece-id", help="补录演出曲目 ID")
    p_supplement.add_argument("--perf-date", help="补录演出日期（YYYY-MM-DD）")

    p_filter = sub.add_parser("filter", help="设置筛选条件")
    p_filter.add_argument("--piece-ids", nargs="+", help="曲目 ID 列表")
    p_filter.add_argument("--section-ids", nargs="+", help="声部 ID 列表")
    p_filter.add_argument("--date-from", help="起始日期（YYYY-MM-DD）")
    p_filter.add_argument("--date-to", help="截止日期（YYYY-MM-DD）")
    p_filter.add_argument("--source", choices=["system", "manual"], help="按来源筛选")
    p_filter.add_argument("--clear", action="store_true", help="清除筛选条件")

    p_export = sub.add_parser("export", help="导出报告")
    p_export.add_argument("--format", choices=["json", "markdown"], required=True, help="导出格式")
    p_export.add_argument("--output", required=True, help="输出文件路径")
    p_export.add_argument("--scope", choices=["schedule", "conflicts", "audit", "full"], default="schedule", help="导出范围")

    p_overview = sub.add_parser("overview", help="数据概览")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    state = AppState()
    loader = DataLoader(state)
    validator = DataValidator(state)
    optimizer = ScheduleOptimizer(state)
    detector = ConflictDetector(state)
    audit = AuditTrail(state)
    renderer = TerminalRenderer(state)
    exporter = Exporter(state)

    parser = create_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    if args.command == "load":
        return cmd_load(args, state, loader, audit, renderer)
    elif args.command == "schedule":
        return cmd_schedule(args, state, optimizer, detector, audit, renderer)
    elif args.command == "conflicts":
        return cmd_conflicts(args, state, detector, renderer)
    elif args.command == "compare":
        return cmd_compare(args, state, optimizer, renderer)
    elif args.command == "audit":
        return cmd_audit(args, state, audit, renderer)
    elif args.command == "undo":
        return cmd_undo(args, state, audit, renderer)
    elif args.command == "recalculate":
        return cmd_recalculate(args, state, optimizer, detector, audit, renderer)
    elif args.command == "supplement":
        return cmd_supplement(args, state, loader, audit, renderer)
    elif args.command == "filter":
        return cmd_filter(args, state, audit, renderer)
    elif args.command == "export":
        return cmd_export(args, state, exporter, renderer)
    elif args.command == "overview":
        return cmd_overview(args, state, renderer)
    else:
        parser.print_help()
        return 1


def cmd_load(args, state: AppState, loader: DataLoader, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    source = DataSource(args.source)
    counts = {}

    if args.pieces_csv:
        n = loader.load_pieces_csv(args.pieces_csv, source)
        counts["pieces_csv"] = n
    if args.pieces_json:
        n = loader.load_pieces_json(args.pieces_json, source)
        counts["pieces_json"] = n
    if args.sections_json:
        n = loader.load_sections_json(args.sections_json)
        counts["sections"] = n
    if args.absences_csv:
        n = loader.load_absences_csv(args.absences_csv, source)
        counts["absences_csv"] = n
    if args.absences_json:
        n = loader.load_absences_json(args.absences_json, source)
        counts["absences_json"] = n
    if args.performances_json:
        n = loader.load_performances_json(args.performances_json, source)
        counts["performances"] = n
    if args.reports_json:
        n = loader.load_reports_json(args.reports_json, source)
        counts["reports"] = n

    if not counts:
        print("❌ 未指定任何数据文件。请使用 --pieces-csv 等参数指定。")
        return 1

    source_label = "系统导出" if source == DataSource.SYSTEM else "手动补录"
    audit.record_load(source_label, counts)

    print(f"✅ 数据加载完成（来源：{source_label}）：")
    for key, count in counts.items():
        print(f"   - {key}: {count} 条")
    print()
    print(renderer.render_data_summary())
    return 0


def cmd_schedule(args, state: AppState, optimizer: ScheduleOptimizer, detector: ConflictDetector, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    before_schedule = audit.snapshot_state()

    plan = optimizer.optimize(
        total_available_minutes=args.total_minutes,
        reference_date=args.reference_date,
        difficulty_weight=args.difficulty_weight,
        absence_weight=args.absence_weight,
        urgency_weight=args.urgency_weight,
    )

    after_schedule = audit.snapshot_state()
    audit.record_recalculate(before_schedule.get("schedule"), after_schedule.get("schedule"))

    detector.refresh_state(args.total_minutes)

    print(renderer.render_schedule(plan))
    print()

    conflicts = detector.detect_all(args.total_minutes)
    total_conflicts = sum(len(v) for v in conflicts.values())
    if total_conflicts > 0:
        print(f"⚠️  检测到 {total_conflicts} 项冲突，运行 `conflicts` 命令查看详情。")
    else:
        print("✅ 未检测到冲突。")
    return 0


def cmd_conflicts(args, state: AppState, detector: ConflictDetector, renderer: TerminalRenderer) -> int:
    if args.summary_only:
        summary = detector.summary(args.total_minutes)
        print(renderer.render_conflict_summary(summary))
    else:
        if args.type == "all":
            all_conflicts = detector.detect_all(args.total_minutes)
            flat = []
            for items in all_conflicts.values():
                flat.extend(items)
        else:
            flat = detector.detect_by_type(args.type, args.total_minutes)

        detector.refresh_state(args.total_minutes)
        print(renderer.render_conflicts(flat))
    return 0


def cmd_compare(args, state: AppState, optimizer: ScheduleOptimizer, renderer: TerminalRenderer) -> int:
    comparisons = optimizer.compare_plans()
    print(renderer.render_plan_comparison(comparisons))
    return 0


def cmd_audit(args, state: AppState, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    if args.detail is not None:
        log = state.audit_log
        if args.detail >= len(log):
            print(f"❌ 索引 {args.detail} 超出范围（共 {len(log)} 条）")
            return 1
        print(renderer.render_audit_detail(log[args.detail].to_dict()))
    elif args.diff:
        result = audit.diff_entries(args.diff[0], args.diff[1])
        if "error" in result:
            print(f"❌ {result['error']}")
            return 1
        print(f"📊 {result['summary']}")
        print()
        print("条目 A：")
        print(json.dumps(result["entry_a"], ensure_ascii=False, indent=2))
        print()
        print("条目 B：")
        print(json.dumps(result["entry_b"], ensure_ascii=False, indent=2))
    elif args.action:
        entries = audit.get_by_action(args.action)
        print(renderer.render_audit_log(entries))
    else:
        print(renderer.render_audit_log())
    return 0


def cmd_undo(args, state: AppState, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    entry = audit.undo_last()
    if entry is None:
        print("❌ 没有可撤回的排练方案。")
        return 1
    print("↩️  已撤回最近的排练方案。")
    print(renderer.render_audit_detail(entry.to_dict()))
    return 0


def cmd_recalculate(args, state: AppState, optimizer: ScheduleOptimizer, detector: ConflictDetector, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    before = audit.snapshot_state()

    plan = optimizer.optimize(
        total_available_minutes=args.total_minutes,
        reference_date=args.reference_date,
    )

    after = audit.snapshot_state()
    audit.record_recalculate(before.get("schedule"), after.get("schedule"))

    detector.refresh_state(args.total_minutes)

    print("🔄 已基于当前数据重新计算排练方案。")
    print()
    print(renderer.render_schedule(plan))
    return 0


def cmd_supplement(args, state: AppState, loader: DataLoader, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    did_something = False

    if args.piece_name:
        before = audit.snapshot_state()
        piece = loader.add_piece_manual(
            name=args.piece_name,
            duration_minutes=args.piece_duration,
            difficulty_score=args.piece_difficulty,
        )
        after = audit.snapshot_state()
        audit.record_supplement(f"曲目 {piece.name}", before, after)
        print(f"✅ 已补录曲目：{piece.name}（ID: {piece.id}，时长 {piece.duration_minutes} 分钟，难度 {piece.difficulty_score}）")
        did_something = True

    if args.absence_person:
        before = audit.snapshot_state()
        absence = loader.add_absence_manual(
            person_name=args.absence_person,
            section_id=args.absence_section or "",
            date=args.absence_date or "",
        )
        after = audit.snapshot_state()
        audit.record_supplement(f"缺勤 {absence.person_name}", before, after)
        print(f"✅ 已补录缺勤：{absence.person_name}（{absence.section_id} / {absence.date}）")
        did_something = True

    if args.perf_piece_id:
        before = audit.snapshot_state()
        perf = loader.add_performance_manual(
            piece_id=args.perf_piece_id,
            date=args.perf_date or "",
        )
        after = audit.snapshot_state()
        audit.record_supplement(f"演出 {perf.piece_id}", before, after)
        print(f"✅ 已补录演出：曲目 {perf.piece_id}（{perf.date}）")
        did_something = True

    if not did_something:
        print("❌ 请指定要补录的数据：--piece-name / --absence-person / --perf-piece-id")
        return 1

    return 0


def cmd_filter(args, state: AppState, audit: AuditTrail, renderer: TerminalRenderer) -> int:
    before = {
        "piece_ids": state.current_filter.piece_ids,
        "section_ids": state.current_filter.section_ids,
        "date_from": state.current_filter.date_from,
        "date_to": state.current_filter.date_to,
        "source_filter": state.current_filter.source_filter.value if state.current_filter.source_filter else None,
    }

    if args.clear:
        state.clear_filter()
        print("✅ 已清除所有筛选条件。")
    else:
        if args.piece_ids:
            state.current_filter.piece_ids = args.piece_ids
        if args.section_ids:
            state.current_filter.section_ids = args.section_ids
        if args.date_from:
            state.current_filter.date_from = args.date_from
        if args.date_to:
            state.current_filter.date_to = args.date_to
        if args.source:
            state.current_filter.source_filter = DataSource(args.source)
        print("✅ 筛选条件已更新。")

    after = {
        "piece_ids": state.current_filter.piece_ids,
        "section_ids": state.current_filter.section_ids,
        "date_from": state.current_filter.date_from,
        "date_to": state.current_filter.date_to,
        "source_filter": state.current_filter.source_filter.value if state.current_filter.source_filter else None,
    }
    audit.record_filter_change(before, after)
    print()
    print(renderer.render_filter())
    return 0


def cmd_export(args, state: AppState, exporter: Exporter, renderer: TerminalRenderer) -> int:
    if args.format == "json":
        path = exporter.export_json(args.output, args.scope)
    else:
        path = exporter.export_markdown(args.output, args.scope)
    print(f"📄 已导出报告：{path}")
    print(f"   格式：{args.format} | 范围：{args.scope}")
    print(f"   筛选条件与终端当前视图一致。")
    return 0


def cmd_overview(args, state: AppState, renderer: TerminalRenderer) -> int:
    print(renderer.render_data_summary())
    print()
    print(renderer.render_filter())
    return 0


if __name__ == "__main__":
    sys.exit(main())
