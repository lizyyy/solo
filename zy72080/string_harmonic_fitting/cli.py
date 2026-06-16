#!/usr/bin/env python3
"""
弦乐泛音频率拟合 - 命令行工具

用法:
  python -m string_harmonic_fitting.cli fit   --params <参数表CSV> [--historical <历史CSV>] [--notes <备注CSV>] [--out <输出目录>]
  python -m string_harmonic_fitting.cli note  --params <参数表CSV> --note-id <ID> --instrument <乐器> --string <弦号> --harmonic <泛音号> --text <备注内容> --author <作者> [--historical <历史CSV>] [--notes <备注CSV>] [--out <输出目录>]
  python -m string_harmonic_fitting.cli check --params <参数表CSV> [--out <输出目录>]
  python -m string_harmonic_fitting.cli trace --trace-file <追踪日志JSON>
"""

import argparse
import os
import sys
import json
from datetime import datetime

from .models import (
    ParameterEntry,
    HistoricalRecord,
    ManualNote,
    OutOfBoundsSample,
    FittingResult,
    load_csv,
    save_csv,
)
from .fitting import HarmonicFitter
from .weights import WeightManager
from .boundaries import BoundaryChecker
from .units import UnitConverter
from .export import Exporter, NoteManager
from .traceability import TraceLog


def _ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def cmd_fit(args):
    params = load_csv(args.params, "parameter")
    historical = load_csv(args.historical, "historical") if args.historical else []
    existing_notes = load_csv(args.notes, "note") if args.notes else []

    trace_log = TraceLog()
    weight_mgr = WeightManager()
    boundary_chk = BoundaryChecker()
    unit_conv = UnitConverter()

    weight_map = {}
    for e in params:
        k = (e.instrument, e.string_index)
        if k not in weight_map:
            weight_map[k] = {}
        weight_map[k][e.harmonic_number] = e.weight

    for (inst, si), w in weight_map.items():
        weight_mgr.set_weights(inst, si, w, operator="parameter_table", reason="从参数表加载权重")

    fitter = HarmonicFitter(
        weight_manager=weight_mgr,
        boundary_checker=boundary_chk,
        unit_converter=unit_conv,
        trace_log=trace_log,
    )

    instruments_strings = set()
    for e in params:
        instruments_strings.add((e.instrument, e.string_index))

    results = []
    for inst, si in sorted(instruments_strings):
        result = fitter.fit(params, inst, si, historical=historical, notes=existing_notes)
        results.append(result)
        print(f"\n{'='*50}")
        print(f"拟合完成: {inst} 第{si}弦")
        print(f"  基频 f1 = {result.fitted_f1:.4f} Hz")
        print(f"  非谐性 B = {result.fitted_B:.8f}")
        print(f"  模型: f_n = n × {result.fitted_f1:.4f} × sqrt(1 + {result.fitted_B:.8f} × n²)")
        print(f"\n  判断依据:")
        for i, r in enumerate(result.reasoning, 1):
            print(f"    {i}. {r}")
        if result.boundary_alerts:
            print(f"\n  边界告警:")
            for a in result.boundary_alerts:
                print(f"    {a}")
        if result.unit_conversion_notes:
            print(f"\n  单位换算:")
            for n in result.unit_conversion_notes:
                print(f"    {n}")
        print(f"\n  原始来源: {', '.join(result.original_sources[:5])}")
        print(f"  处理时间: {result.timestamp}")

        predictions = fitter.predict(result.fitted_f1, result.fitted_B, max_harmonic=max(n for n in result.residuals.keys()) + 2 if result.residuals else 10)
        print(f"\n  预测泛音频率 (前{len(predictions)}阶):")
        for n, fn in sorted(predictions.items()):
            res_str = f" (残差={result.residuals.get(n, 'N/A')})" if n in result.residuals else " (预测)"
            print(f"    n={n}: {fn:.4f} Hz{res_str}")

    out_dir = args.out or "."
    _ensure_dir(out_dir)

    exporter = Exporter()
    exporter.export_csv(results, os.path.join(out_dir, "fitting_results.csv"))
    exporter.export_readable(results, os.path.join(out_dir, "fitting_results.txt"))
    exporter.export_trace_log(trace_log, os.path.join(out_dir, "trace_log.json"))
    exporter.export_trace_log_readable(trace_log, os.path.join(out_dir, "trace_log.txt"))

    trace_log.add(
        action="export",
        source="cli_fit",
        detail=f"导出 {len(results)} 条拟合结果到 {out_dir}",
    )

    print(f"\n结果已导出到: {out_dir}/")
    print(f"  fitting_results.csv  - CSV格式（含完整reasoning JSON）")
    print(f"  fitting_results.txt  - 可读文本（每条判断依据单独一行）")
    print(f"  trace_log.json       - 追踪日志JSON")
    print(f"  trace_log.txt        - 追踪日志可读文本")


def cmd_note(args):
    params = load_csv(args.params, "parameter")
    historical = load_csv(args.historical, "historical") if args.historical else []
    existing_notes = load_csv(args.notes, "note") if args.notes else []

    for n in existing_notes:
        if n.note_id == args.note_id:
            print(f"\n⚠ 备注 {args.note_id} 已存在，跳过重复追加")
            print(f"  已有内容: {n.note_text} (作者={n.author}, 时间={n.timestamp})")
            return

    trace_log = TraceLog()
    weight_mgr = WeightManager()
    boundary_chk = BoundaryChecker()
    unit_conv = UnitConverter()

    weight_map = {}
    for e in params:
        k = (e.instrument, e.string_index)
        if k not in weight_map:
            weight_map[k] = {}
        weight_map[k][e.harmonic_number] = e.weight
    for (inst, si), w in weight_map.items():
        weight_mgr.set_weights(inst, si, w, operator="parameter_table", reason="从参数表加载权重")

    fitter = HarmonicFitter(
        weight_manager=weight_mgr,
        boundary_checker=boundary_chk,
        unit_converter=unit_conv,
        trace_log=trace_log,
    )
    note_mgr = NoteManager(trace_log=trace_log)

    result_before = fitter.fit(params, args.instrument, args.string, historical=historical, notes=existing_notes)

    new_note = ManualNote(
        note_id=args.note_id,
        instrument=args.instrument,
        string_index=args.string,
        harmonic_number=args.harmonic,
        note_text=args.text,
        author=args.author,
    )
    all_notes = existing_notes + [new_note]

    result_after = fitter.fit(params, args.instrument, args.string, historical=historical, notes=all_notes)

    note_mgr.add_note(new_note, before_result=result_before, after_result=result_after)

    print(f"\n{'='*50}")
    print(f"备注补录: [{new_note.note_id}] {new_note.note_text}")
    print(f"  作者: {new_note.author}  时间: {new_note.timestamp}")
    if new_note.weight_action:
        print(f"  权重动作: {new_note.weight_action} (泛音 n={new_note.harmonic_number})")
    print(f"\n  补录前拟合:")
    print(f"    f1 = {result_before.fitted_f1:.4f} Hz, B = {result_before.fitted_B:.8f}")
    for n in sorted(result_before.residuals.keys()):
        print(f"    残差 n={n}: {result_before.residuals[n]:+.6f} Hz (权重={result_before.weights_used.get(n, 0):.4f})")
    print(f"\n  补录后拟合:")
    print(f"    f1 = {result_after.fitted_f1:.4f} Hz, B = {result_after.fitted_B:.8f}")
    for n in sorted(result_after.residuals.keys()):
        print(f"    残差 n={n}: {result_after.residuals[n]:+.6f} Hz (权重={result_after.weights_used.get(n, 0):.4f})")
    print(f"\n  差异说明:")
    print(note_mgr.format_diffs())

    out_dir = args.out or "."
    _ensure_dir(out_dir)
    note_mgr.save_diffs_csv(os.path.join(out_dir, "note_diffs.csv"))
    with open(os.path.join(out_dir, "note_diffs.txt"), "w", encoding="utf-8") as f:
        f.write(note_mgr.format_diffs())

    save_csv(os.path.join(out_dir, "notes_updated.csv"), all_notes)

    trace_log.add(
        action="note_export",
        source="cli_note",
        detail=f"补录备注 {new_note.note_id}，差异已导出",
    )

    exporter = Exporter()
    exporter.export_trace_log(trace_log, os.path.join(out_dir, "trace_log_note.json"))
    exporter.export_trace_log_readable(trace_log, os.path.join(out_dir, "trace_log_note.txt"))

    print(f"差异与追踪已导出到: {out_dir}/")


def cmd_check(args):
    if not args.params and not args.out_of_bounds:
        print("错误: 至少需要 --params 或 --out-of-bounds 之一")
        return

    from .units import UnitConverter
    uc = UnitConverter()
    boundary_chk = BoundaryChecker()

    anomalies = []

    if args.params:
        params = load_csv(args.params, "parameter")
        for e in params:
            inst_range = boundary_chk.freq_ranges.get(e.instrument)
            if inst_range and e.string_index in inst_range:
                low, high = inst_range[e.string_index]
                expected_low = e.harmonic_number * low
                expected_high = e.harmonic_number * high
                freq_hz = uc.to_hz(e.observed_freq, e.unit)
                is_oob, msg = boundary_chk.check_out_of_bounds(freq_hz, expected_low, expected_high)
                if is_oob:
                    dev_pct = 0.0
                    if freq_hz < expected_low:
                        dev_pct = (freq_hz - expected_low) / expected_low * 100
                    elif freq_hz > expected_high:
                        dev_pct = (freq_hz - expected_high) / expected_high * 100
                    oob = OutOfBoundsSample(
                        sample_id=f"chk_{e.instrument}_s{e.string_index}_n{e.harmonic_number}",
                        instrument=e.instrument,
                        string_index=e.string_index,
                        harmonic_number=e.harmonic_number,
                        observed_freq=freq_hz,
                        expected_low=expected_low,
                        expected_high=expected_high,
                        deviation_pct=round(dev_pct, 2),
                        unit="Hz",
                        source=e.source,
                        timestamp=e.timestamp,
                    )
                    anomalies.append(oob)

    if args.out_of_bounds:
        oob_samples = load_csv(args.out_of_bounds, "out_of_bounds")
        for s in oob_samples:
            is_oob, msg = boundary_chk.check_out_of_bounds(
                s.observed_freq, s.expected_low, s.expected_high
            )
            if is_oob:
                anomalies.append(s)

    total_checked = 0
    if args.params:
        total_checked += len(load_csv(args.params, "parameter"))
    if args.out_of_bounds:
        total_checked += len(load_csv(args.out_of_bounds, "out_of_bounds"))

    print(f"\n{'='*50}")
    print(f"异常检查: 共 {total_checked} 条，发现 {len(anomalies)} 条异常")
    if anomalies:
        for a in anomalies:
            print(f"\n  ⚠ [{a.sample_id}]")
            print(f"    乐器: {a.instrument} 第{a.string_index}弦 泛音 n={a.harmonic_number}")
            print(f"    观测: {a.observed_freq:.4f} {a.unit}")
            print(f"    预期范围: [{a.expected_low:.4f}, {a.expected_high:.4f}] Hz")
            print(f"    偏差: {a.deviation_pct:+.2f}%")
            print(f"    来源: {a.source} @ {a.timestamp}")
    else:
        print("  ✓ 所有数据在参考范围内")

    out_dir = args.out or "."
    _ensure_dir(out_dir)
    if anomalies:
        save_csv(os.path.join(out_dir, "anomalies.csv"), anomalies)
        print(f"\n异常清单已导出到: {out_dir}/anomalies.csv")
    else:
        print(f"\n无异常，未生成 anomalies.csv")


def cmd_trace(args):
    tl = TraceLog.load(args.trace_file)
    print(tl.format_readable())


def main():
    parser = argparse.ArgumentParser(
        prog="string_harmonic_fitting",
        description="弦乐泛音频率拟合 - 可追溯、可解释的拟合工具",
    )
    sub = parser.add_subparsers(dest="command")

    p_fit = sub.add_parser("fit", help="运行弦乐泛音频率拟合")
    p_fit.add_argument("--params", required=True, help="参数表 CSV 文件路径")
    p_fit.add_argument("--historical", help="历史记录 CSV 文件路径")
    p_fit.add_argument("--notes", help="人工备注 CSV 文件路径")
    p_fit.add_argument("--out", default="output", help="输出目录 (默认: output)")

    p_note = sub.add_parser("note", help="补录人工备注并查看差异")
    p_note.add_argument("--params", required=True, help="参数表 CSV 文件路径")
    p_note.add_argument("--note-id", required=True, help="备注 ID")
    p_note.add_argument("--instrument", required=True, help="乐器名称")
    p_note.add_argument("--string", type=int, required=True, help="弦序号")
    p_note.add_argument("--harmonic", type=int, required=True, help="泛音序号")
    p_note.add_argument("--text", required=True, help="备注内容")
    p_note.add_argument("--author", required=True, help="备注作者")
    p_note.add_argument("--historical", help="历史记录 CSV 文件路径")
    p_note.add_argument("--notes", help="已有备注 CSV 文件路径")
    p_note.add_argument("--out", default="output", help="输出目录 (默认: output)")

    p_check = sub.add_parser("check", help="检查参数表或越界样本中的异常")
    p_check.add_argument("--params", help="参数表 CSV 文件路径")
    p_check.add_argument("--out-of-bounds", help="越界样本 CSV 文件路径 (out_of_bounds_samples.csv)")
    p_check.add_argument("--out", default="output", help="输出目录 (默认: output)")

    p_trace = sub.add_parser("trace", help="查看追踪日志")
    p_trace.add_argument("--trace-file", required=True, help="追踪日志 JSON 文件路径")

    args = parser.parse_args()

    if args.command == "fit":
        cmd_fit(args)
    elif args.command == "note":
        cmd_note(args)
    elif args.command == "check":
        cmd_check(args)
    elif args.command == "trace":
        cmd_trace(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
