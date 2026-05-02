#!/usr/bin/env python3
import argparse
from pathlib import Path
import sys
from . import __version__
from .parser import (
    parse_welds,
    parse_probes,
    parse_echoes,
    parse_acceptance_rules,
)
from .geometry import process_echoes
from .rules import apply_rules, generate_summary
from .exporter import export_markdown, export_recheck_csv, export_html


def main():
    parser = argparse.ArgumentParser(
        description="钢结构焊缝超声探伤结果复核工具"
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"weldscan-audit {__version__}",
    )

    subparsers = parser.add_subparsers(dest="command")

    run_parser = subparsers.add_parser("run", help="运行分析")
    run_parser.add_argument(
        "--welds",
        type=Path,
        required=True,
        help="焊缝清单 CSV 文件路径",
    )
    run_parser.add_argument(
        "--probes",
        type=Path,
        required=True,
        help="探头/材料声速 YAML 文件路径",
    )
    run_parser.add_argument(
        "--echoes",
        type=Path,
        required=True,
        help="缺陷回波 JSONL 文件路径",
    )
    run_parser.add_argument(
        "--rules",
        type=Path,
        required=True,
        help="验收规则 YAML 文件路径",
    )
    run_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("."),
        help="输出目录 (默认: 当前目录)",
    )
    run_parser.add_argument(
        "--merge-tolerance",
        type=float,
        default=3.0,
        help="重复缺陷合并容差 (mm, 默认: 3.0)",
    )

    args = parser.parse_args()

    if args.command == "run":
        run_analysis(args)
    else:
        parser.print_help()


def run_analysis(args):
    print("=" * 60)
    print("焊缝超声探伤结果复核工具")
    print("=" * 60)

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    print("\n[1/6] 解析输入文件...")
    try:
        welds = parse_welds(args.welds)
        probes = parse_probes(args.probes)
        echoes = parse_echoes(args.echoes)
        rules = parse_acceptance_rules(args.rules)
    except Exception as e:
        print(f"  错误: 解析文件失败 - {e}")
        sys.exit(1)

    print(f"  - 焊缝数: {len(welds)}")
    print(f"  - 探头数: {len(probes)}")
    print(f"  - 回波数: {len(echoes)}")
    print(f"  - 规则数: {len(rules)}")

    print("\n[2/6] 计算缺陷位置...")
    defects = process_echoes(echoes, welds, probes, args.merge_tolerance)
    print(f"  - 缺陷数 (合并后): {len(defects)}")

    print("\n[3/6] 应用验收规则...")
    defects = apply_rules(defects, rules, welds)
    summary = generate_summary(defects)
    print(f"  - 严重缺陷: {summary['critical']}")
    print(f"  - 主要缺陷: {summary['major']}")
    print(f"  - 次要缺陷: {summary['minor']}")
    print(f"  - 可接受缺陷: {summary['acceptable']}")

    print("\n[4/6] 导出 Markdown 报告...")
    md_path = output_dir / "flaw_report.md"
    export_markdown(defects, welds, md_path)
    print(f"  - 已保存到: {md_path}")

    print("\n[5/6] 导出复核 CSV...")
    csv_path = output_dir / "recheck.csv"
    export_recheck_csv(defects, welds, csv_path)
    print(f"  - 已保存到: {csv_path}")

    print("\n[6/6] 导出 HTML 剖面图...")
    html_path = output_dir / "profile.html"
    export_html(defects, welds, html_path)
    print(f"  - 已保存到: {html_path}")

    print("\n" + "=" * 60)
    print("分析完成!")
    print("=" * 60)
    print(f"\n输出文件:")
    print(f"  - {md_path}")
    print(f"  - {csv_path}")
    print(f"  - {html_path}")


if __name__ == "__main__":
    main()
