import argparse
import csv
import os
import sys
from datetime import datetime

from pension_rebalance.loader import load_all
from pension_rebalance.engine import reconcile, detect_duplicate_receipts, detect_duplicate_refunds
from pension_rebalance.reporter import print_terminal_summary, write_detail_csv, write_diff_report


def _find_data_dir() -> str:
    candidates = [
        os.path.join(os.getcwd(), "samples"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples"),
    ]
    for d in candidates:
        if os.path.isdir(d):
            return d
    return os.getcwd()


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="pension-rebalance",
        description="养老目标基金调仓对账工具",
    )
    parser.add_argument(
        "-d", "--data-dir",
        default=None,
        help="数据目录(含receipts.csv/refunds.csv/approvals.csv/notes.csv)，默认自动查找samples/",
    )
    parser.add_argument(
        "-o", "--output-dir",
        default=None,
        help="输出目录(存放reconcile_detail.csv等)，默认./output/",
    )
    parser.add_argument(
        "--prev",
        default=None,
        help="上一次对账明细CSV路径，传入后生成差异报告",
    )

    args = parser.parse_args(argv)

    data_dir = args.data_dir or _find_data_dir()
    if not os.path.isdir(data_dir):
        print(f"错误: 数据目录不存在 - {data_dir}", file=sys.stderr)
        sys.exit(1)

    output_dir = args.output_dir or os.path.join(os.getcwd(), "output")

    print(f"数据目录: {data_dir}")
    print(f"输出目录: {output_dir}")

    data = load_all(data_dir)
    load_warnings = data["warnings"]

    dup_receipts = detect_duplicate_receipts(data["receipts"])
    dup_refunds = detect_duplicate_refunds(data["refunds"])

    results = reconcile(
        receipts=data["receipts"],
        refunds=data["refunds"],
        approvals=data["approvals"],
        notes=data["notes"],
    )

    print_terminal_summary(
        results=results,
        load_warnings=load_warnings,
        duplicate_receipts=dup_receipts,
        duplicate_refunds=dup_refunds,
    )

    detail_path = write_detail_csv(results, output_dir)
    print(f"\n财务明细已写入: {detail_path}")

    change_path = os.path.join(output_dir, "change_chain.csv")
    if os.path.exists(change_path):
        print(f"晚到附件变更链: {change_path}")

    if args.prev:
        prev_results = _load_prev_results(args.prev)
        diff_path = write_diff_report(prev_results, results, output_dir)
        print(f"差异报告: {diff_path}")

    return 0


def _load_prev_results(path: str):
    from pension_rebalance.models import ReconcileResult

    results = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            r = ReconcileResult(
                transaction_id=row.get("交易流水号", ""),
                fund_code=row.get("基金代码", ""),
                amount_match=row.get("金额匹配", ""),
                judgment=row.get("判定", ""),
                judgment_reason=row.get("判定原因", ""),
            )
            results.append(r)
    return results


if __name__ == "__main__":
    sys.exit(main())
