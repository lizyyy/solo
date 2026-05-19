import argparse
import os
import sys
from typing import Optional

from .parser import HarParser
from .analyzer import HarAnalyzer, BucketConfig
from .tracker import SourceTracker
from .reporter import Reporter


def print_console_summary(analysis: dict, file_path: str) -> None:
    print("\n" + "=" * 60)
    print("HAR延迟分桶分析 - 控制台摘要")
    print("=" * 60)
    print(f"源文件: {file_path}")

    summary = analysis["summary"]
    print(f"\n总请求数: {summary['total_entries']}")
    print(f"有效请求: {summary['valid_entries']}")
    print(f"坏行数: {summary['bad_entries']}")
    print(f"唯一域名数: {summary['unique_domains']}")

    percentiles = summary["percentiles"]
    print(f"\n延迟统计:")
    print(f"  P50: {percentiles.get('p50', 0):.1f} ms")
    print(f"  P90: {percentiles.get('p90', 0):.1f} ms")
    print(f"  P95: {percentiles.get('p95', 0):.1f} ms")
    print(f"  P99: {percentiles.get('p99', 0):.1f} ms")

    print(f"\n耗时分桶分布:")
    for bucket, stats in analysis["by_time_bucket"].items():
        ratio = stats["count"] / summary["valid_entries"] * 100
        print(f"  {bucket}: {stats['count']} ({ratio:.1f}%)")

    print(f"\n域名统计 (TOP 10 按请求数):")
    domain_list = sorted(
        analysis["by_domain"].items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )[:10]
    for domain, stats in domain_list:
        print(f"  {domain}: {stats['count']} 次, 平均 {stats['avg_time']:.1f}ms")

    anomalies = analysis["anomalies"]
    print(f"\n异常慢请求阈值 (P95 * 1.5): {anomalies.get('anomaly_threshold_ms', 0):.1f} ms")
    print(f"最慢请求 (TOP 5):")
    for idx, entry in enumerate(anomalies["slowest_entries"][:5], 1):
        print(f"  {idx}. [{entry.raw_index}] {entry.time:.1f}ms - {entry.domain}")

    if analysis["bad_entries"]:
        print(f"\n坏行记录 (共 {len(analysis['bad_entries'])} 条):")
        for entry in analysis["bad_entries"][:5]:
            print(f"  [{entry.raw_index}] {entry.bad_reason}")

    print("\n" + "=" * 60)


def analyze_har_file(
    file_path: str,
    output_dir: Optional[str] = None,
    format_type: str = "all",
    anomaly_samples: int = 20,
    anomaly_threshold_p95: float = 1.5,
) -> int:
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在 - {file_path}")
        return 1

    print(f"正在解析 HAR 文件: {file_path}...")

    parser = HarParser()
    parse_result = parser.parse_file(file_path)

    if not parse_result["success"]:
        print(f"解析失败: {parse_result.get('error', '未知错误')}")
        return 1

    all_entries = parser.get_all_entries()
    print(f"解析完成: 共 {parse_result['total_entries']} 条, "
          f"有效 {parse_result['valid_entries']} 条, "
          f"坏行 {parse_result['bad_entries_count']} 条")

    bucket_config = BucketConfig(
        max_anomaly_samples=anomaly_samples,
        anomaly_threshold_p95=anomaly_threshold_p95,
    )

    analyzer = HarAnalyzer(bucket_config)
    analyzer.set_entries(all_entries)

    print("正在进行分桶统计分析...")
    analysis = analyzer.get_full_analysis()

    tracker = SourceTracker()
    tracker.track_entries(all_entries)

    print_console_summary(analysis, file_path)

    if output_dir:
        reporter = Reporter(analysis)
        base_name = os.path.splitext(os.path.basename(file_path))[0]

        if format_type in ["all", "html"]:
            html_path = os.path.join(output_dir, f"{base_name}_analysis.html")
            print(f"生成 HTML 报告: {html_path}")
            reporter.generate_html(html_path, file_path)

        if format_type in ["all", "csv"]:
            csv_path = os.path.join(output_dir, f"{base_name}_analysis.csv")
            print(f"生成 CSV 报告: {csv_path}")
            reporter.generate_csv(csv_path)

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="HAR延迟分桶异常样本保留排查CLI - 分析HAR文件性能问题",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  har-analyzer input.har -o ./output
  har-analyzer input.har -o ./output -f html
  har-analyzer input.har --anomaly-samples 30
        """,
    )

    parser.add_argument("har_file", help="HAR文件路径")

    parser.add_argument(
        "-o", "--output-dir",
        default="./har_analysis_output",
        help="输出目录 (默认: ./har_analysis_output)",
    )

    parser.add_argument(
        "-f", "--format",
        choices=["all", "html", "csv"],
        default="all",
        help="输出格式 (默认: all)",
    )

    parser.add_argument(
        "--anomaly-samples",
        type=int,
        default=20,
        help="异常样本保留数量 (默认: 20)",
    )

    parser.add_argument(
        "--anomaly-threshold",
        type=float,
        default=1.5,
        help="异常阈值倍数(P95 * n) (默认: 1.5)",
    )

    parser.add_argument(
        "--no-output",
        action="store_true",
        help="仅在控制台输出摘要，不生成文件",
    )

    args = parser.parse_args()

    output_dir = None if args.no_output else args.output_dir

    exit_code = analyze_har_file(
        file_path=args.har_file,
        output_dir=output_dir,
        format_type=args.format,
        anomaly_samples=args.anomaly_samples,
        anomaly_threshold_p95=args.anomaly_threshold,
    )

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
