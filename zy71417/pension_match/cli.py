from __future__ import annotations

import argparse
import os
import sys

from .matcher import run_match
from .parsers import parse_bujiao_dan, parse_can_bao_ren, parse_dan_wei_hui_kuan
from .reporter import print_report, write_csv_bad, write_csv_normal, write_csv_problems


def _resolve_path(p: str) -> str:
    if not os.path.isfile(p):
        print(f"错误: 文件不存在 — {p}", file=sys.stderr)
        sys.exit(1)
    return os.path.abspath(p)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="pension-match",
        description="养老金补缴到账匹配 — 批量比对补缴单、参保人、单位汇款，分离正常/问题/坏数据",
    )
    parser.add_argument(
        "--bujiao", required=True, help="补缴单 CSV 文件路径"
    )
    parser.add_argument(
        "--canbaoren", required=True, help="参保人 CSV 文件路径"
    )
    parser.add_argument(
        "--huikuan", required=True, help="单位汇款 CSV 文件路径"
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="CSV 报告输出目录（默认当前目录）",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="不输出 CSV 报告，仅打印文本报告",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="不打印文本报告，仅输出 CSV",
    )

    args = parser.parse_args(argv)

    bujiao_path = _resolve_path(args.bujiao)
    canbaoren_path = _resolve_path(args.canbaoren)
    huikuan_path = _resolve_path(args.huikuan)

    all_bad: list = []

    with open(bujiao_path, encoding="utf-8-sig") as f:
        bujiao_dans, bad_bujiao = parse_bujiao_dan(os.path.basename(bujiao_path), f)
    all_bad.extend(bad_bujiao)

    with open(canbaoren_path, encoding="utf-8-sig") as f:
        can_bao_rens, bad_cbr = parse_can_bao_ren(os.path.basename(canbaoren_path), f)
    all_bad.extend(bad_cbr)

    with open(huikuan_path, encoding="utf-8-sig") as f:
        hui_kuans, bad_hk = parse_dan_wei_hui_kuan(os.path.basename(huikuan_path), f)
    all_bad.extend(bad_hk)

    results = run_match(bujiao_dans, can_bao_rens, hui_kuans)

    if not args.quiet:
        print_report(results, all_bad)

    if not args.no_csv:
        os.makedirs(args.output_dir, exist_ok=True)
        normal_path = os.path.join(args.output_dir, "正常记录.csv")
        problems_path = os.path.join(args.output_dir, "问题记录.csv")
        bad_path = os.path.join(args.output_dir, "坏数据.csv")

        write_csv_normal(results, normal_path)
        write_csv_problems(results, problems_path)
        write_csv_bad(all_bad, bad_path)

        if not args.quiet:
            print(f"\nCSV 报告已输出至:", file=sys.stderr)
            print(f"  正常记录: {normal_path}", file=sys.stderr)
            print(f"  问题记录: {problems_path}", file=sys.stderr)
            print(f"  坏数据:   {bad_path}", file=sys.stderr)

    normal_count = sum(1 for r in results if not r.problems)
    problem_count = sum(1 for r in results if r.problems)
    if problem_count > 0 or len(all_bad) > 0:
        sys.exit(2)


if __name__ == "__main__":
    main()
