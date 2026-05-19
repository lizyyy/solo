#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from .parser import JSONLParser
from .session import SessionStitcher
from .gap_detector import GapDetector
from .reporter import ReportGenerator
from .exporter import Exporter


def main():
    parser = argparse.ArgumentParser(
        description="JSONL事件会话缝合缺口标记排查CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "--inputs", "-i",
        nargs="+",
        required=True,
        help="输入JSONL文件路径，支持多个文件"
    )
    
    parser.add_argument(
        "--user-field", "-u",
        default="user_id",
        help="用户标识字段名"
    )
    
    parser.add_argument(
        "--session-field", "-s",
        default="session_id",
        help="会话标识字段名"
    )
    
    parser.add_argument(
        "--time-field", "-t",
        default="event_time",
        help="事件时间字段名"
    )
    
    parser.add_argument(
        "--time-format",
        default="iso",
        choices=["iso", "timestamp_ms", "timestamp_s"],
        help="时间格式"
    )
    
    parser.add_argument(
        "--gap-threshold", "-g",
        type=int,
        default=1800,
        help="缺口阈值（秒），超过此时间视为会话缺口"
    )
    
    parser.add_argument(
        "--session-timeout",
        type=int,
        default=3600,
        help="会话超时时间（秒），超过则视为新会话"
    )
    
    parser.add_argument(
        "--output-format", "-f",
        default="ndjson",
        choices=["ndjson", "csv"],
        help="输出格式"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="stitched_sessions",
        help="输出文件路径（不含扩展名）"
    )
    
    parser.add_argument(
        "--report-path", "-r",
        default="stitch_report.json",
        help="缝合报告输出路径"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细处理信息"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        print(f"开始处理 {len(args.inputs)} 个输入文件...")
    
    parser = JSONLParser(
        user_field=args.user_field,
        session_field=args.session_field,
        time_field=args.time_field,
        time_format=args.time_format
    )
    
    events, bad_lines = parser.parse_files(args.inputs)
    
    if args.verbose:
        print(f"解析完成: {len(events)} 条有效事件, {len(bad_lines)} 条坏行")
    
    stitcher = SessionStitcher(
        user_field=args.user_field,
        session_field=args.session_field,
        time_field=args.time_field
    )
    
    sessions = stitcher.stitch_sessions(events)
    
    if args.verbose:
        print(f"会话合并完成: {len(sessions)} 个会话")
    
    gap_detector = GapDetector(
        gap_threshold=args.gap_threshold,
        session_timeout=args.session_timeout,
        time_field=args.time_field
    )
    
    sessions_with_gaps = gap_detector.detect_gaps(sessions)
    
    if args.verbose:
        total_gaps = sum(len(s.get('gaps', [])) for s in sessions_with_gaps)
        print(f"缺口检测完成: 共发现 {total_gaps} 处缺口")
    
    exporter = Exporter(
        output_format=args.output_format,
        time_field=args.time_field
    )
    
    output_path = exporter.export(sessions_with_gaps, args.output)
    
    if args.verbose:
        print(f"输出文件已保存至: {output_path}")
    
    reporter = ReportGenerator()
    report = reporter.generate(
        input_files=args.inputs,
        total_events=len(events),
        bad_lines=bad_lines,
        total_sessions=len(sessions_with_gaps),
        sessions_with_gaps=sessions_with_gaps,
        args=vars(args)
    )
    
    reporter.save(report, args.report_path)
    
    if args.verbose:
        print(f"缝合报告已保存至: {args.report_path}")
        print("\n处理完成!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
