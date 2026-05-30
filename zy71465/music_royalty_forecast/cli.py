from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from typing import Dict, List, Optional

from .importer import (
    detect_cross_source_issues,
    import_activity_calendar,
    import_playback_history,
    import_platform_sharing,
)
from .models import (
    BUILTIN_SCENARIOS,
    ActivityRecord,
    DataIssue,
    DataSource,
    ImportResult,
    PlaybackRecord,
    Scenario,
    SharingRecord,
)
from .engine import forecast_all
from .exporter import (
    export_comparison_csv,
    export_forecasts_csv,
    export_forecasts_json,
    export_issues_csv,
    export_issues_json,
)


class Session:
    def __init__(self):
        self.playbacks: List[PlaybackRecord] = []
        self.sharings: List[SharingRecord] = []
        self.activities: List[ActivityRecord] = []
        self.import_results: List[ImportResult] = []
        self.cross_issues: List[DataIssue] = []
        self.forecast_results: Dict[str, list] = {}
        self.scenarios: List[Scenario] = []
        self._loaded = False

    def is_loaded(self) -> bool:
        return bool(self.playbacks) or bool(self.sharings) or bool(self.activities)

    def has_forecast(self) -> bool:
        return bool(self.forecast_results)


def cmd_import(args: argparse.Namespace, session: Session) -> None:
    playback_file = args.playback
    sharing_file = args.sharing
    activity_file = args.activity

    if not any([playback_file, sharing_file, activity_file]):
        print("[错误] 至少需要提供一个数据文件 (--playback, --sharing, --activity)")
        sys.exit(1)

    for fpath, label in [
        (playback_file, "播放历史"),
        (sharing_file, "平台分成"),
        (activity_file, "活动日历"),
    ]:
        if fpath and not os.path.isfile(fpath):
            print(f"[错误] {label}文件不存在: {fpath}")
            sys.exit(1)

    if playback_file:
        result = import_playback_history(playback_file)
        session.import_results.append(result)
        session.playbacks.extend(result.valid_records)
        _print_import_result(result, "播放历史")

    if sharing_file:
        result = import_platform_sharing(sharing_file)
        session.import_results.append(result)
        session.sharings.extend(result.valid_records)
        _print_import_result(result, "平台分成")

    if activity_file:
        result = import_activity_calendar(activity_file)
        session.import_results.append(result)
        session.activities.extend(result.valid_records)
        _print_import_result(result, "活动日历")

    session.cross_issues = detect_cross_source_issues(
        session.playbacks, session.sharings, session.activities
    )
    if session.cross_issues:
        print(f"\n[跨源校验] 发现 {len(session.cross_issues)} 条问题:")
        for issue in session.cross_issues:
            _print_issue(issue)

    _print_session_summary(session)


def cmd_process(args: argparse.Namespace, session: Session) -> None:
    if not session.is_loaded():
        print("[错误] 尚未导入数据，请先执行 import 命令")
        sys.exit(1)

    scenario_names = args.scenarios.split(",") if args.scenarios else list(BUILTIN_SCENARIOS.keys())
    session.scenarios = []
    for sn in scenario_names:
        sn = sn.strip()
        if sn in BUILTIN_SCENARIOS:
            session.scenarios.append(BUILTIN_SCENARIOS[sn])
        else:
            print(f"[警告] 未知情景 '{sn}'，跳过")

    if not session.scenarios:
        print("[错误] 无可用情景")
        sys.exit(1)

    forecast_days = args.days or 365
    revenue_per_play = args.rpp or 0.005

    print(f"[预测] 情景: {', '.join(s.name for s in session.scenarios)}")
    print(f"[预测] 预测天数: {forecast_days}, 每次播放单价: {revenue_per_play}")
    print(f"[预测] 歌曲-平台组合: {len(set((p.song_id, p.platform) for p in session.playbacks))}")

    session.forecast_results = forecast_all(
        playback_records=session.playbacks,
        sharing_records=session.sharings,
        activity_records=session.activities,
        scenarios=session.scenarios,
        forecast_days=forecast_days,
        revenue_per_play=revenue_per_play,
    )

    for scenario_name, forecasts in session.forecast_results.items():
        total = sum(fr.total_revenue for fr in forecasts)
        print(f"  情景 [{scenario_name}]: {len(forecasts)} 条预测, 总厂牌收益 = {total:.2f}")


def cmd_review(args: argparse.Namespace, session: Session) -> None:
    if not session.is_loaded():
        print("[错误] 尚未导入数据，请先执行 import 命令")
        sys.exit(1)

    print("=" * 60)
    print("数据总览 (Review)")
    print("=" * 60)

    print(f"\n播放记录: {len(session.playbacks)} 条有效")
    if session.playbacks:
        songs = sorted(set(p.song_id for p in session.playbacks))
        platforms = sorted(set(p.platform for p in session.playbacks))
        print(f"  歌曲: {', '.join(songs)}")
        print(f"  平台: {', '.join(platforms)}")

    print(f"\n分成记录: {len(session.sharings)} 条有效")
    for s in session.sharings:
        print(f"  {s.platform} (生效 {s.effective_date}): 厂牌={s.label_share}, 艺人={s.artist_share}, 平台={s.platform_share}")

    print(f"\n活动记录: {len(session.activities)} 条有效")
    for a in session.activities:
        print(f"  {a.activity_id} | {a.song_id} | {a.activity_type} | {a.start_date}~{a.end_date} | 倍数={a.exposure_multiplier}")

    all_issues = []
    for ir in session.import_results:
        all_issues.extend(ir.issues)
    all_issues.extend(session.cross_issues)

    if all_issues:
        print(f"\n问题记录: {len(all_issues)} 条")
        errors = [i for i in all_issues if i.severity.value == "error"]
        warnings = [i for i in all_issues if i.severity.value == "warning"]
        print(f"  错误: {len(errors)}, 警告: {len(warnings)}")
        for i in all_issues:
            _print_issue(i)
    else:
        print("\n问题记录: 无")

    if session.forecast_results:
        print("\n预测结果概览:")
        for scenario_name, forecasts in session.forecast_results.items():
            total = sum(fr.total_revenue for fr in forecasts)
            print(f"  [{scenario_name}] 总收益={total:.2f}, 预测条目={len(forecasts)}")

    if args.trace:
        trace_id = args.trace
        print(f"\n[溯源] 查找 trace_id={trace_id}:")
        found = False
        for pb in session.playbacks:
            if pb.trace.trace_id() == trace_id:
                print(f"  播放记录: {pb.to_dict()}")
                found = True
        for sh in session.sharings:
            if sh.trace.trace_id() == trace_id:
                print(f"  分成记录: {sh.to_dict()}")
                found = True
        for act in session.activities:
            if act.trace.trace_id() == trace_id:
                print(f"  活动记录: {act.to_dict()}")
                found = True
        for scenario_name, forecasts in session.forecast_results.items():
            for fr in forecasts:
                for t in fr.traces:
                    if t.trace_id() == trace_id:
                        print(f"  预测结果引用: {fr.song_id}/{fr.platform} [{scenario_name}]")
                        found = True
        if not found:
            print(f"  未找到 trace_id={trace_id}")


def cmd_export(args: argparse.Namespace, session: Session) -> None:
    if not session.is_loaded():
        print("[错误] 尚未导入数据，请先执行 import 命令")
        sys.exit(1)

    output_dir = args.output or "./output"
    fmt = args.format or "both"

    exported_files: List[str] = []

    if session.forecast_results:
        if fmt in ("json", "both"):
            fp = export_forecasts_json(session.forecast_results, output_dir, include_points=not args.summary_only)
            exported_files.append(fp)
            print(f"[导出] 预测结果 (JSON): {fp}")
        if fmt in ("csv", "both"):
            fps = export_forecasts_csv(session.forecast_results, output_dir)
            exported_files.extend(fps)
            for fp in fps:
                print(f"[导出] 预测结果 (CSV): {fp}")

            fp = export_comparison_csv(session.forecast_results, output_dir)
            exported_files.append(fp)
            print(f"[导出] 情景对比 (CSV): {fp}")
    else:
        print("[提示] 尚未执行预测，跳过预测结果导出")

    all_import_issues = []
    for ir in session.import_results:
        all_import_issues.extend(ir.issues)

    if all_import_issues or session.cross_issues:
        fp = export_issues_json(session.import_results, session.cross_issues, output_dir)
        exported_files.append(fp)
        print(f"[导出] 问题记录 (JSON): {fp}")

        fps = export_issues_csv(
            session.import_results, session.cross_issues, output_dir, separate=True
        )
        exported_files.extend(fps)
        for fp in fps:
            print(f"[导出] 问题记录 (CSV): {fp}")
    else:
        print("[提示] 无问题记录，跳过导出")

    print(f"\n[完成] 共导出 {len(exported_files)} 个文件到 {output_dir}/")


def _print_import_result(result: ImportResult, label: str) -> None:
    print(f"\n[{label}] {result.source_file}")
    print(f"  有效: {len(result.valid_records)}, 问题: {len(result.issues)}, 总行: {result.total_rows}")
    if result.issues:
        for issue in result.issues:
            _print_issue(issue)


def _print_issue(issue: DataIssue) -> None:
    sev = "⚠" if issue.severity.value == "warning" else "✗"
    src = f"{issue.trace.source_file}:行{issue.trace.original_row}"
    field_info = f" [{issue.field_name}]" if issue.field_name else ""
    print(f"  {sev} [{issue.rule_code}] {issue.message}{field_info} ← {src}")


def _print_session_summary(session: Session) -> None:
    print("\n" + "=" * 60)
    print("导入汇总")
    print("=" * 60)
    print(f"  播放记录: {len(session.playbacks)}")
    print(f"  分成记录: {len(session.sharings)}")
    print(f"  活动记录: {len(session.activities)}")
    total_issues = sum(len(ir.issues) for ir in session.import_results) + len(session.cross_issues)
    print(f"  问题记录: {total_issues}")
    if total_issues > 0:
        errors = sum(
            1 for ir in session.import_results for i in ir.issues if i.severity.value == "error"
        )
        errors += sum(1 for i in session.cross_issues if i.severity.value == "error")
        warnings = total_issues - errors
        print(f"    错误: {errors}, 警告: {warnings}")


def cmd_run(args: argparse.Namespace, session: Session) -> None:
    import_args = argparse.Namespace(
        playback=args.playback,
        sharing=args.sharing,
        activity=args.activity,
    )
    cmd_import(import_args, session)

    print("\n" + "=" * 60)
    process_args = argparse.Namespace(
        scenarios=args.scenarios,
        days=args.days,
        rpp=args.rpp,
    )
    cmd_process(process_args, session)

    print("\n" + "=" * 60)
    review_args = argparse.Namespace(trace=None)
    cmd_review(review_args, session)

    print("\n" + "=" * 60)
    export_args = argparse.Namespace(
        output=args.output,
        format=args.format,
        summary_only=args.summary_only,
    )
    cmd_export(export_args, session)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="music-royalty-forecast",
        description="音乐版权收益预测 - 命令行工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    p_import = subparsers.add_parser("import", help="导入播放历史、平台分成、活动日历")
    p_import.add_argument("--playback", "-p", help="播放历史 CSV 文件路径")
    p_import.add_argument("--sharing", "-s", help="平台分成 CSV 文件路径")
    p_import.add_argument("--activity", "-a", help="活动日历 CSV 文件路径")

    p_process = subparsers.add_parser("process", help="运行收益预测")
    p_process.add_argument("--scenarios", "-S", help="情景列表(逗号分隔): baseline,optimistic,pessimistic")
    p_process.add_argument("--days", "-d", type=int, help="预测天数(默认365)")
    p_process.add_argument("--rpp", type=float, help="每次播放单价(默认0.005)")

    p_review = subparsers.add_parser("review", help="查看导入数据与预测结果")
    p_review.add_argument("--trace", "-t", help="按 trace_id 溯源")

    p_export = subparsers.add_parser("export", help="导出预测结果与问题记录")
    p_export.add_argument("--output", "-o", help="输出目录(默认 ./output)")
    p_export.add_argument("--format", "-f", choices=["json", "csv", "both"], help="输出格式")
    p_export.add_argument("--summary-only", action="store_true", help="仅导出汇总(不含逐日明细)")

    p_run = subparsers.add_parser("run", help="一键执行: 导入 → 预测 → 总览 → 导出")
    p_run.add_argument("--playback", "-p", required=True, help="播放历史 CSV 文件路径")
    p_run.add_argument("--sharing", "-s", required=True, help="平台分成 CSV 文件路径")
    p_run.add_argument("--activity", "-a", required=True, help="活动日历 CSV 文件路径")
    p_run.add_argument("--scenarios", "-S", help="情景列表(逗号分隔)")
    p_run.add_argument("--days", "-d", type=int, help="预测天数(默认365)")
    p_run.add_argument("--rpp", type=float, help="每次播放单价(默认0.005)")
    p_run.add_argument("--output", "-o", help="输出目录(默认 ./output)")
    p_run.add_argument("--format", "-f", choices=["json", "csv", "both"], help="输出格式")
    p_run.add_argument("--summary-only", action="store_true", help="仅导出汇总(不含逐日明细)")

    return parser


def main(argv: Optional[List[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        sys.exit(0)

    session = Session()
    command_map = {
        "import": cmd_import,
        "process": cmd_process,
        "review": cmd_review,
        "export": cmd_export,
        "run": cmd_run,
    }

    handler = command_map.get(args.command)
    if handler:
        handler(args, session)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
