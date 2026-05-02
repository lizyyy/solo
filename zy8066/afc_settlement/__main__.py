#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="地铁清分复核工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    audit_parser = subparsers.add_parser("audit", help="执行清分复核")
    audit_parser.add_argument("--tap-events", required=True, help="闸机事件CSV文件路径")
    audit_parser.add_argument("--station-graph", required=True, help="站点图JSON文件路径")
    audit_parser.add_argument("--fare-rules", required=True, help="票价规则YAML文件路径")
    audit_parser.add_argument("--calendar-config", required=True, help="节假日/运营日配置YAML文件路径")
    audit_parser.add_argument("--report", default="settlement_report.md", help="清分报告输出路径")
    audit_parser.add_argument("--adjustments", default="adjustments.csv", help="调整文件输出路径")
    audit_parser.add_argument("--timeline", default="trip_timeline.html", help="时间线HTML输出路径")
    
    args = parser.parse_args()
    
    if args.command == "audit":
        run_audit(args)
    else:
        parser.print_help()


def run_audit(args):
    from .parser import (
        parse_tap_events,
        parse_station_graph,
        parse_fare_rules,
        parse_calendar_config,
    )
    from .state_machine import reconstruct_trips
    from .fare import calculate_fare
    from .anomaly import detect_anomalies
    from .exporter import (
        export_settlement_report,
        export_adjustments,
        export_trip_timeline,
    )
    
    print("正在解析输入文件...")
    events = parse_tap_events(args.tap_events)
    station_graph = parse_station_graph(args.station_graph)
    fare_rules = parse_fare_rules(args.fare_rules)
    calendar_config = parse_calendar_config(args.calendar_config)
    
    print("正在重建行程...")
    all_trips = reconstruct_trips(events, calendar_config)
    
    print("正在检测异常...")
    all_trips = detect_anomalies(all_trips, calendar_config)
    
    print("正在计算票价...")
    for card_id, trips in all_trips.items():
        for trip in trips:
            trip.calculated_fare = calculate_fare(trip, station_graph, fare_rules)
    
    print("正在导出报告...")
    export_settlement_report(all_trips, args.report)
    export_adjustments(all_trips, args.adjustments)
    export_trip_timeline(all_trips, args.timeline)
    
    print(f"处理完成！")
    print(f"  - 报告: {args.report}")
    print(f"  - 调整: {args.adjustments}")
    print(f"  - 时间线: {args.timeline}")


if __name__ == "__main__":
    main()
