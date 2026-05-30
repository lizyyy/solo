from __future__ import annotations

import argparse
import sys
from typing import List, Optional

from .anomaly import detect_anomalies, explain_all
from .analysis import aggregate_by_zone, compare_trends, compute_deviations, rank_zones_by_instability
from .importer import ConflictPolicy, DataStore
from .models import TuningPhase
from .report import build_full_report, export_csv, export_json, generate_text_report


def _parse_phase(s: str) -> TuningPhase:
    m = {
        "before": TuningPhase.BEFORE,
        "after": TuningPhase.AFTER,
        "前": TuningPhase.BEFORE,
        "后": TuningPhase.AFTER,
    }
    return m.get(s.lower(), TuningPhase.BEFORE)


def _parse_conflict(s: str) -> ConflictPolicy:
    m = {
        "skip": ConflictPolicy.SKIP,
        "update": ConflictPolicy.UPDATE,
        "error": ConflictPolicy.ERROR,
        "跳过": ConflictPolicy.SKIP,
        "更新": ConflictPolicy.UPDATE,
        "冲突": ConflictPolicy.ERROR,
    }
    return m.get(s.lower(), ConflictPolicy.ERROR)


def cmd_import(args):
    store = DataStore()
    phase = _parse_phase(args.default_phase)
    policy = _parse_conflict(args.conflict)

    for filepath in args.files:
        result = store.load_from_file(
            filepath=filepath,
            conflict_policy=policy,
            default_piano_id=args.piano_id,
            default_date=args.date,
            default_phase=phase,
            fill_merged=not args.no_fill_merged,
        )
        print(f"\n文件: {filepath}")
        print(result.summary())

        if result.conflicts:
            print(f"\n发现 {len(result.conflicts)} 条冲突:")
            for c in result.conflicts[:10]:
                print(f"  键: {c.existing.primary_key}")
                for field, old, new in c.field_differences:
                    print(f"    {field}: {old} → {new}")
            if len(result.conflicts) > 10:
                print(f"  ... 还有 {len(result.conflicts) - 10} 条冲突")
            print("\n请使用 --conflict=skip 跳过或 --conflict=update 更新来处理冲突")

        if result.parse_warnings:
            print(f"\n解析警告:")
            for w in result.parse_warnings[:20]:
                print(f"  ⚠ {w}")
            if len(result.parse_warnings) > 20:
                print(f"  ... 还有 {len(result.parse_warnings) - 20} 条警告")

    if args.save_db:
        import json
        data = {}
        for pk, rec in store.records.items():
            data[pk] = {
                "piano_id": rec.piano_id,
                "note_raw": rec.note_raw,
                "measured_freq": rec.measured_freq,
                "freq_unit": rec.freq_unit,
                "deviation_cents": rec.deviation_cents,
                "tuning_date": rec.tuning_date,
                "tuning_phase": rec.tuning_phase.value,
                "room_temp": rec.room_temp,
                "room_humidity": rec.room_humidity,
                "customer_note": rec.customer_note,
            }
        with open(args.save_db, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n数据库已保存到 {args.save_db}")

    return store


def cmd_report(args):
    store = DataStore()

    if args.db:
        import json
        with open(args.db, "r", encoding="utf-8") as f:
            data = json.load(f)
        for pk, item in data.items():
            from .models import parse_note
            note_parsed = parse_note(item.get("note_raw", ""))
            rec = type('TuningRecord')(
                piano_id=item.get("piano_id", ""),
                note_raw=item.get("note_raw", ""),
                note_parsed=note_parsed,
                measured_freq=item.get("measured_freq"),
                freq_unit=item.get("freq_unit", "Hz"),
                deviation_cents=item.get("deviation_cents"),
                tuning_date=item.get("tuning_date", ""),
                tuning_phase=TuningPhase(item.get("tuning_phase", "unknown")),
                room_temp=item.get("room_temp"),
                room_humidity=item.get("room_humidity"),
                customer_note=item.get("customer_note", ""),
                source_file="db",
                row_index=0,
            )
            store.records[pk] = rec
    else:
        phase = _parse_phase(args.default_phase)
        policy = _parse_conflict(args.conflict)
        for filepath in args.files:
            store.load_from_file(
                filepath=filepath,
                conflict_policy=policy,
                default_piano_id=args.piano_id,
                default_date=args.date,
                default_phase=phase,
                fill_merged=not args.no_fill_merged,
            )

    records = store.get_all_records()
    if not records:
        print("无数据可生成报告")
        return

    piano_ids = set(r.piano_id for r in records)
    for pid in piano_ids:
        piano_records = [r for r in records if r.piano_id == pid]
        report = build_full_report(pid, piano_records)

        text = generate_text_report(
            pid,
            piano_records,
            report["deviations"],
            report["aggregates"],
            report["trends"],
            report["anomalies"],
        )

        if args.output:
            outpath = args.output
            if len(piano_ids) > 1:
                base, ext = os.path.splitext(outpath)
                outpath = f"{base}_{pid}{ext}"
            with open(outpath, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"文本报告已保存到 {outpath}")
        else:
            print(text)

        if args.json:
            export_json(
                pid, piano_records,
                report["deviations"],
                report["aggregates"],
                report["trends"],
                report["anomalies"],
                args.json,
            )
            print(f"JSON 报告已保存到 {args.json}")

        if args.csv:
            export_csv(report["deviations"], args.csv)
            print(f"CSV 报告已保存到 {args.csv}")


def cmd_check(args):
    store = DataStore()
    phase = _parse_phase(args.default_phase)
    for filepath in args.files:
        store.load_from_file(
            filepath=filepath,
            conflict_policy=ConflictPolicy.ERROR,
            default_piano_id=args.piano_id,
            default_date=args.date,
            default_phase=phase,
        )

    records = store.get_all_records()
    if not records:
        print("无数据可检查")
        return

    deviations = compute_deviations(records)
    anomalies = detect_anomalies(records, deviations)

    if anomalies:
        print(explain_all(anomalies))
    else:
        print("数据质量检查通过，未发现异常。")


def cmd_zones(args):
    store = DataStore()
    phase = _parse_phase(args.default_phase)
    for filepath in args.files:
        store.load_from_file(
            filepath=filepath,
            conflict_policy=ConflictPolicy.UPDATE,
            default_piano_id=args.piano_id,
            default_date=args.date,
            default_phase=phase,
        )

    records = store.get_all_records()
    if not records:
        print("无数据")
        return

    deviations = compute_deviations(records)
    aggregates = aggregate_by_zone(deviations)
    ranked = rank_zones_by_instability(aggregates)

    print("音区稳定性排名 (从最不稳定到最稳定):\n")
    for i, (zone, agg) in enumerate(ranked, 1):
        print(f"  {i}. {zone.value}")
        print(f"     平均频偏: {_fmt(agg.avg_deviation_cents)} 音分 | "
              f"最大频偏: {_fmt(agg.max_deviation_cents)} 音分 | "
              f"标准差: {_fmt(agg.std_deviation_cents)}")
        if agg.unstable_notes:
            print(f"     不稳定音名: {', '.join(agg.unstable_notes)}")
        print()


def _fmt(val):
    if val is None:
        return "-"
    return f"{val:.2f}"


import os


def main(argv: Optional[List[str]] = None):
    parser = argparse.ArgumentParser(
        prog="piano-tuning",
        description="钢琴调律频偏统计 CLI - 记录、分析和报告钢琴调律前后的频偏数据",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--piano-id", "-p", default="", help="默认钢琴编号")
    common.add_argument("--date", "-d", default="", help="默认调律日期 (YYYY-MM-DD)")
    common.add_argument("--default-phase", choices=["before", "after", "前", "后"], default="before", help="默认调律阶段")
    common.add_argument("--no-fill-merged", action="store_true", help="不自动填充合并单元格")

    p_import = subparsers.add_parser("import", parents=[common], help="导入调律数据")
    p_import.add_argument("files", nargs="+", help="数据文件路径 (CSV/Excel/JSON)")
    p_import.add_argument("--conflict", "-c", choices=["skip", "update", "error", "跳过", "更新", "冲突"], default="error",
                          help="重复数据处理策略: skip=跳过, update=更新覆盖, error=报冲突")
    p_import.add_argument("--save-db", metavar="FILE", help="将导入数据保存为数据库文件(JSON)")

    p_report = subparsers.add_parser("report", parents=[common], help="生成统计报告")
    p_report.add_argument("files", nargs="*", help="数据文件路径 (CSV/Excel/JSON)")
    p_report.add_argument("--conflict", "-c", choices=["skip", "update", "error"], default="update",
                          help="重复数据处理策略")
    p_report.add_argument("--output", "-o", help="文本报告输出路径")
    p_report.add_argument("--json", metavar="FILE", help="JSON 报告输出路径")
    p_report.add_argument("--csv", metavar="FILE", help="CSV 报告输出路径")
    p_report.add_argument("--db", metavar="FILE", help="从数据库文件加载(替代文件导入)")

    p_check = subparsers.add_parser("check", parents=[common], help="检查数据质量")
    p_check.add_argument("files", nargs="+", help="数据文件路径")

    p_zones = subparsers.add_parser("zones", parents=[common], help="查看音区稳定性排名")
    p_zones.add_argument("files", nargs="+", help="数据文件路径")

    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return

    if args.command == "import":
        cmd_import(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "check":
        cmd_check(args)
    elif args.command == "zones":
        cmd_zones(args)


if __name__ == "__main__":
    main()
