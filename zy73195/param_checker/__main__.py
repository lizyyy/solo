import argparse
import os
import sys

from .checker import load_params, load_records, batch_check, save_results_csv
from .reporter import print_summary, print_review_page
from .review import load_rejudge_history, apply_rejudge_to_results, print_rejudge_diff
from .models import CheckSummary


def main():
    parser = argparse.ArgumentParser(
        prog="param_checker",
        description="优化调参批量验算 — 终端摘要与CSV明细分离",
    )
    parser.add_argument(
        "--input-dir", "-i",
        default="./param_checker/data",
        help="输入目录（包含 params.csv、records.csv）",
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="./output",
        help="输出目录（验算结果CSV、改判记录等）",
    )
    parser.add_argument(
        "--params",
        default="params.csv",
        help="参数表文件名（默认 params.csv）",
    )
    parser.add_argument(
        "--records",
        default="records.csv",
        help="实测记录文件名（默认 records.csv）",
    )
    parser.add_argument(
        "--review", "-r",
        action="store_true",
        help="显示复核页（参数版本/异常点/解释同页）",
    )
    parser.add_argument(
        "--rejudge-history",
        default="rejudge_history.csv",
        help="改判历史文件名（默认 rejudge_history.csv）",
    )
    parser.add_argument(
        "--show-rejudge",
        action="store_true",
        help="显示改判记录及前后差别",
    )

    args = parser.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)

    params_path = os.path.join(input_dir, args.params)
    records_path = os.path.join(input_dir, args.records)
    results_path = os.path.join(output_dir, "check_results.csv")
    rejudge_in_path = os.path.join(input_dir, args.rejudge_history)
    rejudge_out_path = os.path.join(output_dir, args.rejudge_history)

    if not os.path.exists(params_path):
        print(f"❌ 错误：参数表不存在: {params_path}")
        sys.exit(1)
    if not os.path.exists(records_path):
        print(f"❌ 错误：实测记录不存在: {records_path}")
        sys.exit(1)

    print(f"📂 输入目录: {input_dir}")
    print(f"📂 输出目录: {output_dir}")
    print()

    params = load_params(params_path)
    records = load_records(records_path)

    results, summary = batch_check(records, params)

    rejudge_history = []
    rejudged_count = 0
    if os.path.exists(rejudge_in_path):
        rejudge_history = load_rejudge_history(rejudge_in_path)
        rejudged_count = apply_rejudge_to_results(results, rejudge_history)
        summary.rejudged = rejudged_count

    print_summary(summary, results)

    save_results_csv(results, results_path)
    print(f"\n📄 明细已写入: {results_path}")

    if os.path.exists(rejudge_in_path):
        import shutil
        os.makedirs(output_dir, exist_ok=True)
        shutil.copy2(rejudge_in_path, rejudge_out_path)

    if args.show_rejudge:
        print_rejudge_diff(rejudge_history)

    if args.review:
        print_review_page(summary, results, rejudge_count=rejudged_count)

    print(f"\n✅ 验算完成，共 {len(results)} 条记录")


if __name__ == "__main__":
    main()
