"""CLI 模块 - 命令行接口"""

import argparse
import sys
from pathlib import Path

from aqua_guard.data.importer import (
    load_water_quality_csv,
    load_feed_plan_yaml,
    load_weather_forecast_json,
    load_pond_thresholds,
    merge_pond_data,
    DataLoadError,
)
from aqua_guard.sim.engine import simulate_24h
from aqua_guard.report.exporter import export_risk_report, export_adjusted_feed, export_alerts


def main():
    parser = argparse.ArgumentParser(
        prog='aqua_guard',
        description='水产养殖场夜班监控 CLI - 模拟未来 24 小时水质和投喂变化',
    )
    subparsers = parser.add_subparsers(dest='command', help='子命令')

    run_parser = subparsers.add_parser('run', help='运行模拟')
    run_parser.add_argument(
        '--water-quality', '-w',
        required=True,
        help='池塘水质时序 CSV 文件路径',
    )
    run_parser.add_argument(
        '--feed-plan', '-f',
        required=True,
        help='投喂计划 YAML 文件路径',
    )
    run_parser.add_argument(
        '--weather', '-W',
        required=True,
        help='天气预报 JSON 文件路径',
    )
    run_parser.add_argument(
        '--thresholds', '-t',
        required=True,
        help='池塘阈值配置 JSON 文件路径',
    )
    run_parser.add_argument(
        '--output', '-o',
        default='./output',
        help='输出目录路径 (默认: ./output)',
    )

    args = parser.parse_args()

    if args.command == 'run':
        run_simulation(
            water_quality_path=args.water_quality,
            feed_plan_path=args.feed_plan,
            weather_path=args.weather,
            thresholds_path=args.thresholds,
            output_dir=args.output,
        )
    else:
        parser.print_help()
        sys.exit(1)


def run_simulation(
    water_quality_path: str,
    feed_plan_path: str,
    weather_path: str,
    thresholds_path: str,
    output_dir: str,
):
    """执行模拟流程"""
    print("=" * 60)
    print("Aqua Guard - 水产养殖场夜班监控系统")
    print("=" * 60)
    print()

    try:
        print("[1/4] 加载水质数据...")
        water_records = load_water_quality_csv(water_quality_path)
        print(f"      加载了 {len(water_records)} 条水质记录")

        print("[2/4] 加载投喂计划...")
        feed_plan = load_feed_plan_yaml(feed_plan_path)
        print(f"      加载了 {len(feed_plan)} 个池塘的投喂计划")

        print("[3/4] 加载天气预报...")
        forecast = load_weather_forecast_json(weather_path)
        print(f"      加载了 {len(forecast.get('forecast', []))} 小时预报")

        print("[4/4] 加载池塘阈值配置...")
        thresholds = load_pond_thresholds(thresholds_path)
        print(f"      加载了 {len(thresholds)} 个池塘的阈值配置")

    except DataLoadError as e:
        print(f"\n错误: {e}", file=sys.stderr)
        sys.exit(1)

    print()
    print("-" * 60)
    print("合并数据并执行 24 小时模拟...")
    merged = merge_pond_data(water_records, feed_plan, forecast, thresholds)
    simulation = simulate_24h(merged)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print()
    print("-" * 60)
    print("导出报告...")

    risk_report_path = export_risk_report(simulation, output_path)
    print(f"  ✓ 风险报告: {risk_report_path}")

    feed_csv_path = export_adjusted_feed(simulation, output_path)
    print(f"  ✓ 调整投喂: {feed_csv_path}")

    alerts_path = export_alerts(simulation, output_path)
    print(f"  ✓ 告警信息: {alerts_path}")

    print()
    print("=" * 60)
    print("模拟完成!")
    print("=" * 60)


if __name__ == '__main__':
    main()
