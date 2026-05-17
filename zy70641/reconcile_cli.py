#!/usr/bin/env python3
import argparse
import sys
import time
from typing import List
from config import AppConfig
from parser import TransactionParser
from matcher import TransactionMatcher
from analyzer import DiscrepancyAnalyzer
from reporter import ReportGenerator


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║          收银支付差异退款窗口重复流水排查工具                 ║
║          Cash Register & Payment Gateway Reconciliation      ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def print_summary(result):
    print("\n" + "=" * 60)
    print("对账结果汇总")
    print("=" * 60)
    print(f"收银机流水总数: {result.summary.total_cash_register}")
    print(f"支付平台流水总数: {result.summary.total_payment_gateway}")
    print(f"匹配成功: {result.summary.matched_count}")
    print(f"未匹配: {result.summary.unmatched_count}")
    print(f"重复流水: {result.summary.duplicate_count}")
    print(f"坏行数: {result.summary.bad_row_count}")
    print(f"处理时间: {result.summary.processing_time:.2f} 秒")
    print()

    if result.summary.discrepancy_breakdown:
        print("差异原因统计:")
        for reason, count in sorted(result.summary.discrepancy_breakdown.items(), key=lambda x: -x[1]):
            print(f"  - {reason.value}: {count}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="收银支付差异退款窗口重复流水排查CLI工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python reconcile_cli.py --cash cash1.csv cash2.csv --payment payment1.csv
  python reconcile_cli.py --cash "data/cash/*.csv" --payment "data/payment/*.csv"
  python reconcile_cli.py --cash cash.csv --payment payment.csv --time-window 10
        """
    )

    parser.add_argument(
        "--cash", "-c",
        nargs="+",
        required=True,
        help="收银机流水CSV文件路径，支持通配符（如: cash/*.csv）"
    )

    parser.add_argument(
        "--payment", "-p",
        nargs="+",
        required=True,
        help="支付平台流水CSV文件路径，支持通配符（如: payment/*.csv）"
    )

    parser.add_argument(
        "--config",
        help="配置文件路径（JSON格式）"
    )

    parser.add_argument(
        "--time-window",
        type=int,
        default=5,
        help="支付交易时间窗口（分钟），默认5分钟"
    )

    parser.add_argument(
        "--refund-time-window",
        type=int,
        default=1440,
        help="退款交易时间窗口（分钟），默认24小时"
    )

    parser.add_argument(
        "--amount-tolerance",
        type=float,
        default=0.01,
        help="金额匹配容差，默认0.01"
    )

    parser.add_argument(
        "--no-duplicate-check",
        action="store_true",
        help="禁用重复流水检测"
    )

    parser.add_argument(
        "--output-dir", "-o",
        default="./reports",
        help="报告输出目录，默认 ./reports"
    )

    parser.add_argument(
        "--format", "-f",
        choices=["csv", "markdown", "all"],
        default="all",
        help="输出格式，默认全部"
    )

    parser.add_argument(
        "--no-store-check",
        action="store_true",
        help="禁用门店编号校验"
    )

    args = parser.parse_args()

    print_banner()

    config = AppConfig.load(args.config) if args.config else AppConfig.default()
    config.matching.time_window_minutes = args.time_window
    config.matching.refund_time_window_minutes = args.refund_time_window
    config.matching.amount_tolerance = args.amount_tolerance
    config.matching.enable_duplicate_detection = not args.no_duplicate_check
    config.matching.store_id_required = not args.no_store_check
    config.report.output_dir = args.output_dir
    config.report.generate_csv = args.format in ["csv", "all"]
    config.report.generate_markdown = args.format in ["markdown", "all"]

    print("配置参数:")
    print(f"  - 时间窗口: {config.matching.time_window_minutes} 分钟")
    print(f"  - 退款时间窗口: {config.matching.refund_time_window_minutes} 分钟")
    print(f"  - 金额容差: {config.matching.amount_tolerance}")
    print(f"  - 重复检测: {'启用' if config.matching.enable_duplicate_detection else '禁用'}")
    print(f"  - 门店校验: {'启用' if config.matching.store_id_required else '禁用'}")
    print()

    start_time = time.time()

    print("正在解析收银机流水...")
    transaction_parser = TransactionParser(config)
    cash_txs, cash_bad_rows = transaction_parser.parse_cash_register(args.cash)
    print(f"  解析完成: {len(cash_txs)} 条有效记录, {len(cash_bad_rows)} 条坏行")

    print("正在解析支付平台流水...")
    payment_txs, payment_bad_rows = transaction_parser.parse_payment_gateway(args.payment)
    print(f"  解析完成: {len(payment_txs)} 条有效记录, {len(payment_bad_rows)} 条坏行")

    print()
    print("正在执行匹配...")
    matcher = TransactionMatcher(config)
    matches, duplicates = matcher.match(cash_txs, payment_txs)
    print(f"  匹配完成: {len(matches)} 条结果")

    print()
    print("正在分析差异...")
    analyzer = DiscrepancyAnalyzer()
    result = analyzer.analyze(
        matches=matches,
        cash_register_count=len(cash_txs),
        payment_gateway_count=len(payment_txs),
        bad_rows=cash_bad_rows + payment_bad_rows,
        duplicates=duplicates,
        start_time=start_time,
        end_time=time.time()
    )

    print_summary(result)

    print("正在生成报告...")
    reporter = ReportGenerator(config)
    outputs = reporter.generate(result)

    print("报告已生成:")
    for fmt, path in outputs.items():
        print(f"  - {fmt.upper()}: {path}")

    print()
    print("处理完成!")

    if result.summary.unmatched_count > 0 or result.summary.duplicate_count > 0:
        print(f"⚠️  发现 {result.summary.unmatched_count} 条未匹配记录, {result.summary.duplicate_count} 条重复记录")
        sys.exit(1)


if __name__ == "__main__":
    main()
