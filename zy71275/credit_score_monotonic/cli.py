from __future__ import annotations

import argparse
import json
import sys
from typing import Dict, List

from .checker import CheckConfig, MonotonicChecker
from .models import BinRecord, MonotonicDirection
from .report import ReportGenerator


def parse_bins_from_json(filepath: str) -> Dict[str, List[BinRecord]]:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    feature_bins: Dict[str, List[BinRecord]] = {}
    for feature_name, bin_list in data.get("features", {}).items():
        bins = []
        for item in bin_list:
            bins.append(
                BinRecord(
                    bin_name=item["bin_name"],
                    bad_count=int(item["bad_count"]),
                    total_count=int(item["total_count"]),
                    score_weight=float(item["score_weight"]),
                    is_missing=bool(item.get("is_missing", False)),
                )
            )
        feature_bins[feature_name] = bins

    return feature_bins


def main():
    parser = argparse.ArgumentParser(
        description="信用评分单调性约束检查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "示例:\n"
            "  python -m credit_score_monotonic --input data.json --model-version v1.0\n"
            "  python -m credit_score_monotonic --input data.json --model-version v1.0 --min-sample 100\n"
        ),
    )

    parser.add_argument(
        "--input", required=True, help="输入JSON文件路径, 包含特征分箱数据"
    )
    parser.add_argument(
        "--model-version", required=True, help="模型版本标识"
    )
    parser.add_argument(
        "--min-sample",
        type=int,
        default=50,
        help="低样本箱阈值 (默认: 50)",
    )
    parser.add_argument(
        "--direction",
        choices=["auto", "ascending", "descending"],
        default="auto",
        help="单调方向 (默认: auto自动检测)",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.005,
        help="坏账率容差 (默认: 0.005)",
    )
    parser.add_argument(
        "--missing-threshold",
        type=float,
        default=0.05,
        help="缺失箱占比告警阈值 (默认: 0.05)",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="报告输出目录 (默认: 当前目录)",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="输出文件名前缀 (默认: 使用模型版本号)",
    )

    args = parser.parse_args()

    direction_map = {
        "auto": MonotonicDirection.AUTO,
        "ascending": MonotonicDirection.ASCENDING,
        "descending": MonotonicDirection.DESCENDING,
    }

    config = CheckConfig(
        min_sample_size=args.min_sample,
        monotonic_direction=direction_map[args.direction],
        bad_rate_tolerance=args.tolerance,
        missing_bin_threshold=args.missing_threshold,
    )

    feature_bins = parse_bins_from_json(args.input)

    checker = MonotonicChecker(config)
    report = checker.check(feature_bins, args.model_version)

    print(report.summary)
    print()

    files = ReportGenerator.export_report(
        report, output_dir=args.output_dir, prefix=args.prefix
    )

    print("报告文件已导出:")
    for ftype, fpath in files.items():
        print(f"  {ftype}: {fpath}")

    if not report.overall_pass:
        sys.exit(1)


if __name__ == "__main__":
    main()
