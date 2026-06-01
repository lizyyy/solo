#!/usr/bin/env python3
import argparse
import json
import sys

from arbitrage.loader import load_rates
from arbitrage.units import validate_units
from arbitrage.search import find_arbitrage_paths
from arbitrage.annotator import apply_annotation
from arbitrage.exporter import export_results


def cmd_search(args):
    records = load_rates(args.input)
    print(f"已加载 {len(records)} 条汇率记录")

    valid, uncomputable, anomalies = validate_units(records)
    print(f"有效记录: {len(valid)}，无法计算: {len(uncomputable)}，异常提醒: {len(anomalies)}")

    if uncomputable:
        print("\n--- 无法计算的记录 ---")
        for r in uncomputable:
            print(f"  行{r.row_index}: {r.from_currency}→{r.to_currency} | 原因: {r.compute_reason} | 备注: {r.original_notes}")

    if anomalies:
        print("\n--- 异常提醒 ---")
        for a in anomalies:
            print(f"  [{a.anomaly_type}] {a.from_currency}→{a.to_currency} | {a.detail}")

    result = find_arbitrage_paths(valid, min_profit_pct=args.min_profit)
    result.anomalies = anomalies
    result.uncomputable_records = uncomputable
    result.total_rows_loaded = len(records)
    result.total_rows_valid = len(valid)
    result.total_rows_uncomputable = len(uncomputable)

    if result.paths:
        print(f"\n--- 发现 {len(result.paths)} 条套利路径 ---")
        for i, p in enumerate(result.paths, 1):
            print(f"\n路径 {i}: {' → '.join(p.cycle)} → {p.cycle[0]}")
            print(f"  理论收益率: {p.profit_pct:.4f}%")
            print(f"  来源: {' | '.join(s for s in p.original_sources if s)}")
            if any(p.original_notes):
                print(f"  原始备注: {' | '.join(n for n in p.original_notes if n)}")
            print(f"  分析: {p.reasoning}")
    else:
        print("\n未发现满足条件的套利路径")

    if args.output:
        exported = export_results(result, args.output, fmt=args.format)
        print(f"\n导出完成:")
        for k, v in exported.items():
            print(f"  {k}: {v}")


def cmd_annotate(args):
    records = load_rates(args.input)
    valid, uncomputable, anomalies = validate_units(records)

    record, entry, diffs = apply_annotation(
        valid + uncomputable, args.row, args.text, args.by
    )

    print(f"已为行 {args.row} 补录备注")
    print(f"  补录内容: {args.text}")
    print(f"  补录人: {args.by}")
    print(f"  当前备注: {record.original_notes}")

    if diffs:
        print("\n--- 补录后差异 ---")
        for d in diffs:
            print(f"  字段 [{d.field}]:")
            print(f"    变更前: {d.before}")
            print(f"    变更后: {d.after}")
            print(f"    说明: {d.explanation}")

    result = find_arbitrage_paths(valid, min_profit_pct=args.min_profit)
    result.anomalies = anomalies

    if args.output:
        exported = export_results(result, args.output, fmt=args.format,
                                  annotation_diffs=diffs)
        print(f"\n导出完成:")
        for k, v in exported.items():
            print(f"  {k}: {v}")


def cmd_validate(args):
    records = load_rates(args.input)
    valid, uncomputable, anomalies = validate_units(records)

    print(f"总记录: {len(records)}")
    print(f"有效记录: {len(valid)}")
    print(f"无法计算: {len(uncomputable)}")
    print(f"异常提醒: {len(anomalies)}")

    if args.verbose:
        if uncomputable:
            print("\n--- 无法计算详情 ---")
            for r in uncomputable:
                print(f"  行{r.row_index}: {r.from_currency or '(空)'}→{r.to_currency or '(空)'}")
                print(f"    原因: {r.compute_reason}")
                print(f"    备注: {r.original_notes}")
                print(f"    来源: {r.original_source}")

        if anomalies:
            print("\n--- 异常详情 ---")
            for a in anomalies:
                print(f"  [{a.anomaly_type}] 行{a.row_index}: {a.detail}")
                if a.original_notes:
                    print(f"    备注: {a.original_notes}")


def main():
    parser = argparse.ArgumentParser(
        prog="arbitrage",
        description="多币种套利路径搜索工具 - 从历史汇率样本中发现套利机会",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    search_parser = subparsers.add_parser("search", help="搜索套利路径")
    search_parser.add_argument("input", help="汇率数据文件路径 (.csv/.json/.jsonl)")
    search_parser.add_argument("-o", "--output", help="导出目录")
    search_parser.add_argument("-f", "--format", default="csv", choices=["csv", "json"],
                               help="导出格式 (默认 csv)")
    search_parser.add_argument("--min-profit", type=float, default=0.01,
                               help="最小收益率阈值%% (默认 0.01)")

    annotate_parser = subparsers.add_parser("annotate", help="为记录补录备注")
    annotate_parser.add_argument("input", help="汇率数据文件路径")
    annotate_parser.add_argument("--row", type=int, required=True, help="要补录的行索引")
    annotate_parser.add_argument("--text", required=True, help="补录内容")
    annotate_parser.add_argument("--by", default="operator", help="补录人 (默认 operator)")
    annotate_parser.add_argument("-o", "--output", help="导出目录")
    annotate_parser.add_argument("-f", "--format", default="csv", choices=["csv", "json"],
                                 help="导出格式")
    annotate_parser.add_argument("--min-profit", type=float, default=0.01,
                                 help="最小收益率阈值%%")

    validate_parser = subparsers.add_parser("validate", help="校验汇率数据")
    validate_parser.add_argument("input", help="汇率数据文件路径")
    validate_parser.add_argument("-v", "--verbose", action="store_true",
                                 help="显示详细信息")

    args = parser.parse_args()

    if args.command == "search":
        cmd_search(args)
    elif args.command == "annotate":
        cmd_annotate(args)
    elif args.command == "validate":
        cmd_validate(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
