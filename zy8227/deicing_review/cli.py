import argparse
import sys
from pathlib import Path
from typing import Optional

from .readers import (
    FlightPlanReader, WeatherReader, FluidBatchReader, SprayRecordReader
)
from .engine import DeicingReviewEngine
from .writers import CSVWriter, ReportGenerator


def main():
    parser = argparse.ArgumentParser(
        description="机场跑道除冰作业复核工具 - 离线复核航班放行除冰合规性",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python -m deicing_review --flights flights.csv --weather weather.csv \\
      --batches batches.yaml --sprays sprays.jsonl \\
      --output-issues issues.csv --output-report deicing_review.md

  使用默认输出文件名:
  python -m deicing_review -f flights.csv -w weather.csv -b batches.yaml -s sprays.jsonl
        """
    )
    
    parser.add_argument(
        '-f', '--flights', '--flight-plan',
        dest='flights',
        required=True,
        help='航班放行计划 CSV 文件路径'
    )
    
    parser.add_argument(
        '-w', '--weather',
        dest='weather',
        required=True,
        help='跑道气象分钟数据 CSV 文件路径'
    )
    
    parser.add_argument(
        '-b', '--batches', '--fluid-batches',
        dest='batches',
        required=True,
        help='除冰液批次配置 YAML 文件路径'
    )
    
    parser.add_argument(
        '-s', '--sprays', '--spray-records',
        dest='sprays',
        required=True,
        help='喷洒作业记录 JSONL 文件路径'
    )
    
    parser.add_argument(
        '-o', '--output-issues',
        dest='output_issues',
        default='issues.csv',
        help='问题清单输出 CSV 文件路径 (默认: issues.csv)'
    )
    
    parser.add_argument(
        '-r', '--output-report',
        dest='output_report',
        default='deicing_review.md',
        help='复核报告输出 Markdown 文件路径 (默认: deicing_review.md)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        dest='verbose',
        action='store_true',
        help='显示详细处理信息'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='deicing-review 1.0.0'
    )
    
    args = parser.parse_args()
    
    try:
        run_review(
            flights_path=args.flights,
            weather_path=args.weather,
            batches_path=args.batches,
            sprays_path=args.sprays,
            output_issues_path=args.output_issues,
            output_report_path=args.output_report,
            verbose=args.verbose
        )
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


def run_review(
    flights_path: str,
    weather_path: str,
    batches_path: str,
    sprays_path: str,
    output_issues_path: str,
    output_report_path: str,
    verbose: bool = False
):
    if verbose:
        print("=" * 60)
        print("除冰作业复核工具 - 开始处理")
        print("=" * 60)
        print(f"航班计划: {flights_path}")
        print(f"气象数据: {weather_path}")
        print(f"液批配置: {batches_path}")
        print(f"喷洒记录: {sprays_path}")
        print("-" * 60)
    
    if verbose:
        print("正在读取航班计划...")
    flight_reader = FlightPlanReader()
    flights = flight_reader.read(flights_path)
    if verbose:
        print(f"  读取到 {len(flights)} 个航班")
    
    if verbose:
        print("正在读取气象数据...")
    weather_reader = WeatherReader()
    weather_records = weather_reader.read(weather_path)
    if verbose:
        print(f"  读取到 {len(weather_records)} 条气象记录")
    
    if verbose:
        print("正在读取除冰液批次配置...")
    batch_reader = FluidBatchReader()
    fluid_batches = batch_reader.read(batches_path)
    if verbose:
        print(f"  读取到 {len(fluid_batches)} 个除冰液批次")
    
    if verbose:
        print("正在读取喷洒作业记录...")
    spray_reader = SprayRecordReader()
    spray_records = spray_reader.read(sprays_path)
    if verbose:
        print(f"  读取到 {len(spray_records)} 条喷洒记录")
    
    if verbose:
        print("-" * 60)
        print("正在执行复核分析...")
    
    engine = DeicingReviewEngine()
    release_windows, issues = engine.analyze(
        flights=flights,
        weather_records=weather_records,
        fluid_batches=fluid_batches,
        spray_records=spray_records
    )
    
    summary = engine.get_summary()
    respray_recs = engine.get_respray_recommendations()
    
    if verbose:
        print(f"  计算放行窗口: {len(release_windows)} 个")
        print(f"  发现问题: {len(issues)} 个")
        print(f"    - 严重问题: {summary.get('critical_issues', 0)}")
        print(f"    - 警告事项: {summary.get('warning_issues', 0)}")
        print(f"  补喷建议: {len(respray_recs)} 条")
    
    if verbose:
        print("-" * 60)
        print("正在生成输出文件...")
    
    csv_writer = CSVWriter()
    csv_writer.write_issues(issues, output_issues_path)
    if verbose:
        print(f"  问题清单已写入: {output_issues_path}")
    
    report_gen = ReportGenerator()
    report_gen.generate_report(
        summary=summary,
        issues=issues,
        release_windows=release_windows,
        respray_recommendations=respray_recs,
        output_path=output_report_path
    )
    if verbose:
        print(f"  复核报告已写入: {output_report_path}")
    
    print("=" * 60)
    print("处理完成!")
    print("=" * 60)
    
    critical = summary.get('critical_issues', 0)
    warning = summary.get('warning_issues', 0)
    
    if critical > 0:
        print(f"\n⚠️  发现 {critical} 个严重问题，必须立即处理!")
    if warning > 0:
        print(f"\n⚠️  发现 {warning} 个警告事项，建议关注。")
    if critical == 0 and warning == 0:
        print("\n✅ 所有检查项均通过，无异常发现。")
    
    print(f"\n输出文件:")
    print(f"  - 问题清单: {output_issues_path}")
    print(f"  - 复核报告: {output_report_path}")


if __name__ == '__main__':
    main()
