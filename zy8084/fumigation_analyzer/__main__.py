#!/usr/bin/env python3
"""
Fumigation Safety Analyzer CLI
Offline review tool for silo fumigation operations.
Analyzes PH3 concentration decay, ventilation coverage, and personnel entry risk.
"""

import sys
import argparse
from pathlib import Path

from .parser import WarehouseParser, SensorParser, VentilationParser, RulesParser
from .model import DecayModel, VentilationModel
from .engine import RiskEngine
from .export import MarkdownExporter, CSVExporter, HTMLExporter


def build_parser():
    parser = argparse.ArgumentParser(
        prog="fumigation-analyzer",
        description="离线复核筒仓熏蒸作业安全开窗时机"
    )
    parser.add_argument("--warehouse", required=True, help="仓房信息 CSV 路径")
    parser.add_argument("--sensors", required=True, help="磷化氢传感器 JSONL 路径")
    parser.add_argument("--ventilation", required=True, help="通风机启停记录 CSV 路径")
    parser.add_argument("--rules", required=True, help="作业规则 YAML 路径")
    parser.add_argument("--output-dir", default=".", help="输出目录 (默认: 当前目录)")
    parser.add_argument("--timezone", default="Asia/Shanghai", help="时区 (默认: Asia/Shanghai)")
    parser.add_argument("--drift-threshold", type=float, default=5.0,
                        help="传感器漂移阈值 ppm (默认: 5.0)")
    parser.add_argument("--report-name", default="fumigation_report",
                        help="报告文件名前缀 (默认: fumigation_report)")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    wh_parser = WarehouseParser(args.warehouse)
    warehouses = wh_parser.parse()

    sensor_parser = SensorParser(args.sensors, drift_threshold=args.drift_threshold)
    sensor_data = sensor_parser.parse()

    vent_parser = VentilationParser(args.ventilation)
    vent_records = vent_parser.parse()

    rules_parser = RulesParser(args.rules)
    rules = rules_parser.parse()

    decay_model = DecayModel(warehouses, sensor_data, timezone=args.timezone)
    timeline = decay_model.build_timeline()

    vent_model = VentilationModel(vent_records, timezone=args.timezone)
    vent_model.annotate_timeline(timeline)

    engine = RiskEngine(rules, timezone=args.timezone)
    risk_events = engine.evaluate(timeline)

    md_exporter = MarkdownExporter(output_dir / f"{args.report_name}.md")
    md_exporter.export(timeline, risk_events, warehouses, sensor_data)

    csv_exporter = CSVExporter(output_dir / "risk_events.csv")
    csv_exporter.export(risk_events)

    html_exporter = HTMLExporter(output_dir / "timeline.html")
    html_exporter.export(timeline, risk_events, warehouses)

    print(f"分析完成。报告已输出至: {output_dir}")
    print(f"  - {args.report_name}.md")
    print(f"  - risk_events.csv")
    print(f"  - timeline.html")


if __name__ == "__main__":
    main()
