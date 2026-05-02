"""CLI module for mooring quality check."""

import argparse
import sys
from pathlib import Path
from typing import List, Optional

from .parser import parse_berth_plan, parse_tidewind, parse_sensor_data, parse_vessel_rules
from .time_alignment import align_by_berth_window
from .rules import detect_tension_peaks, detect_overlimit_duration, detect_sensor_drift, detect_missing_intervals
from .reporter import export_markdown_report, export_alerts_csv, export_html_timeline


def run(args: Optional[List[str]] = None) -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="港口缆绳张力质量检查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m mooring_qc run --berth-plan data/berth_plan.csv \\
                           --tidewind data/tidewind.json \\
                           --sensor data/sensor.jsonl \\
                           --rules data/vessel_rules.yaml \\
                           --output ./report
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="运行缆绳张力检查")
    run_parser.add_argument("--berth-plan", required=True, help="泊位计划CSV文件路径")
    run_parser.add_argument("--tidewind", required=True, help="潮汐/风速JSON文件路径")
    run_parser.add_argument("--sensor", required=True, help="缆绳传感器JSONL文件路径")
    run_parser.add_argument("--rules", required=True, help="船型规则YAML文件路径")
    run_parser.add_argument("--output", default="./output", help="输出目录路径")
    run_parser.add_argument("--peak-threshold", type=float, default=400.0, help="峰值阈值(kN)")
    run_parser.add_argument("--overlimit-pct", type=float, default=1.1, help="超限百分比")

    parser.add_argument("--version", action="version", version="%(prog)s 1.0.0")

    ns = parser.parse_args(args)

    if ns.command == "run":
        return run_check(
            berth_plan_path=ns.berth_plan,
            tidewind_path=ns.tidewind,
            sensor_path=ns.sensor,
            rules_path=ns.rules,
            output_dir=ns.output,
            peak_threshold=ns.peak_threshold,
            overlimit_pct=ns.overlimit_pct,
        )

    parser.print_help()
    return 1


def run_check(
    berth_plan_path: str,
    tidewind_path: str,
    sensor_path: str,
    rules_path: str,
    output_dir: str,
    peak_threshold: float = 400.0,
    overlimit_pct: float = 1.1,
) -> int:
    """Execute mooring quality check."""
    try:
        berth_plans = parse_berth_plan(berth_plan_path)
        tidewind_data = parse_tidewind(tidewind_path)
        sensor_data = parse_sensor_data(sensor_path)
        vessel_rules = parse_vessel_rules(rules_path)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        for berth_plan in berth_plans:
            vessel_type = berth_plan.get("vessel_type", "default")
            rules = vessel_rules.get(vessel_type, vessel_rules.get("default", {}))
            max_tension = berth_plan.get("max_tension_kn", rules.get("max_tension_kn", 500))

            aligned_data = align_by_berth_window(berth_plan, sensor_data, tidewind_data)

            if not aligned_data:
                print(f"警告: {berth_plan['vessel_name']} 在靠泊窗口内无传感器数据")
                continue

            peaks = detect_tension_peaks(aligned_data, peak_threshold)
            overlimits = detect_overlimit_duration(aligned_data, max_tension, overlimit_pct)
            drifts = detect_sensor_drift(aligned_data)
            missing = detect_missing_intervals(aligned_data)

            vessel_name = berth_plan["vessel_name"].replace(" ", "_")
            base_name = f"{berth_plan['berth_id']}_{vessel_name}"

            export_markdown_report(
                output_path / f"{base_name}_report.md",
                berth_plan, peaks, overlimits, drifts, missing, aligned_data
            )
            export_alerts_csv(
                output_path / f"{base_name}_alerts.csv",
                peaks, overlimits, drifts, missing
            )
            export_html_timeline(
                output_path / f"{base_name}_timeline.html",
                berth_plan, aligned_data, peaks, overlimits
            )

            print(f"已完成: {berth_plan['vessel_name']} ({berth_plan['berth_id']})")

        print(f"\n报告已输出至: {output_path.absolute()}")
        return 0

    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
