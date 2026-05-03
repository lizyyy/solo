#!/usr/bin/env python3
"""
日程合并清理工具 (Schedule Cleaner)

用于合并和清理来自多个来源的日程文件（.ics/.csv），
支持时区统一、重复事件展开、重复事件合并、冲突检测等功能。
"""

import os
import sys
import argparse
from datetime import datetime
from typing import List, Tuple, Set
from pathlib import Path

import pytz

from src.models import Event, Conflict, ValidationError
from src.parsers import ICSParser, CSVParser
from src.normalizer import EventNormalizer
from src.deduplicator import EventMerger
from src.conflict import ConflictDetector
from src.exporter import ICSExporter, CSVConflictExporter, ReportExporter


DEFAULT_OUTPUT_DIR = "./output"
DEFAULT_TIMEZONE = pytz.timezone('Asia/Shanghai')


def find_schedule_files(input_dir: str, recursive: bool = True) -> List[str]:
    schedule_files = []
    
    if not os.path.exists(input_dir):
        return schedule_files
    
    if os.path.isfile(input_dir):
        ext = os.path.splitext(input_dir)[1].lower()
        if ext in ['.ics', '.csv']:
            return [input_dir]
        return schedule_files
    
    if recursive:
        for root, dirs, files in os.walk(input_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in ['.ics', '.csv']:
                    schedule_files.append(os.path.join(root, file))
    else:
        for file in os.listdir(input_dir):
            file_path = os.path.join(input_dir, file)
            if os.path.isfile(file_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in ['.ics', '.csv']:
                    schedule_files.append(file_path)
    
    return sorted(schedule_files)


def parse_files(files: List[str], 
               default_timezone,
               csv_profile: str = "default",
               csv_mapping: str = None) -> Tuple[List[Event], List[ValidationError]]:
    all_events: List[Event] = []
    all_errors: List[ValidationError] = []
    
    ics_parser = ICSParser(default_timezone=default_timezone)
    csv_parser = CSVParser(default_timezone=default_timezone, profile=csv_profile,
                           mapping_config_path=csv_mapping)
    
    for file_path in files:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.ics':
            events, errors = ics_parser.parse_file(file_path)
        elif ext == '.csv':
            events, errors = csv_parser.parse_file(file_path)
        else:
            continue
        
        all_events.extend(events)
        all_errors.extend(errors)
    
    return all_events, all_errors


def main():
    parser = argparse.ArgumentParser(
        description='日程合并清理工具 - 合并和清理来自多个来源的日程文件',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  # 处理 examples 目录下的所有日程文件
  python main.py -i ./examples -o ./output
  
  # 处理单个文件
  python main.py -i ./schedule.ics -o ./output
  
  # 不递归搜索子目录
  python main.py -i ./schedules --no-recursive
  
  # 指定时区
  python main.py -i ./examples --timezone "America/New_York"
  
  # 禁用重复事件合并
  python main.py -i ./examples --no-merge
  
  # 自定义通勤缓冲时间（分钟）
  python main.py -i ./examples --commute-buffer 45
        '''
    )
    
    parser.add_argument('-i', '--input', required=True,
                        help='输入目录或文件路径')
    parser.add_argument('-o', '--output', default=DEFAULT_OUTPUT_DIR,
                        help=f'输出目录路径 (默认: {DEFAULT_OUTPUT_DIR})')
    parser.add_argument('--no-recursive', action='store_true',
                        help='不递归搜索子目录')
    parser.add_argument('--timezone', default='Asia/Shanghai',
                        help='目标时区 (默认: Asia/Shanghai)')
    parser.add_argument('--csv-profile', default='default',
                        help='CSV 解析配置文件 (default/school/parttime/fitness)')
    parser.add_argument('--csv-mapping', default=None,
                        help='自定义 CSV 字段映射配置文件路径')
    parser.add_argument('--no-merge', action='store_true',
                        help='禁用重复事件合并')
    parser.add_argument('--no-expand-recurrence', action='store_true',
                        help='不展开重复事件')
    parser.add_argument('--commute-buffer', type=int, default=30,
                        help='通勤缓冲时间（分钟，默认: 30）')
    parser.add_argument('--title-similarity', type=float, default=0.7,
                        help='标题相似度阈值 (0.0-1.0，默认: 0.7)')
    parser.add_argument('--recurrence-limit', type=int, default=100,
                        help='重复事件展开最大数量 (默认: 100)')
    parser.add_argument('--recurrence-months', type=int, default=12,
                        help='重复事件展开最大月数 (默认: 12)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("日程合并清理工具")
    print("=" * 60)
    print(f"输入路径: {args.input}")
    print(f"输出目录: {args.output}")
    print(f"目标时区: {args.timezone}")
    print()
    
    try:
        target_timezone = pytz.timezone(args.timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        print(f"错误: 未知时区 '{args.timezone}'")
        print("可用时区示例: Asia/Shanghai, America/New_York, Europe/London, Asia/Tokyo")
        sys.exit(1)
    
    print("[1/7] 查找日程文件...")
    schedule_files = find_schedule_files(args.input, recursive=not args.no_recursive)
    
    if not schedule_files:
        print(f"错误: 在 '{args.input}' 中未找到任何 .ics 或 .csv 文件")
        sys.exit(1)
    
    print(f"  找到 {len(schedule_files)} 个日程文件:")
    for f in schedule_files:
        print(f"    - {f}")
    print()
    
    print("[2/7] 解析日程文件...")
    events, parse_errors = parse_files(
        schedule_files, 
        target_timezone,
        csv_profile=args.csv_profile,
        csv_mapping=args.csv_mapping
    )
    
    print(f"  解析完成: {len(events)} 个事件")
    if parse_errors:
        print(f"  解析警告/错误: {len(parse_errors)} 个")
    print()
    
    print("[3/7] 规范化事件（时区统一）...")
    normalizer = EventNormalizer(
        target_timezone=target_timezone,
        recurrence_limit=args.recurrence_limit,
        recurrence_until_months=args.recurrence_months
    )
    
    normalized_events, norm_errors = normalizer.normalize_events(events)
    parse_errors.extend(norm_errors)
    
    print(f"  规范化完成: {len(normalized_events)} 个事件")
    print()
    
    if not args.no_expand_recurrence:
        print("[4/7] 展开重复事件...")
        expanded_events, expand_errors = normalizer.expand_recurrences(normalized_events)
        parse_errors.extend(expand_errors)
        
        expanded_count = len(expanded_events) - len(normalized_events)
        print(f"  展开完成: 新增 {expanded_count} 个事件，共 {len(expanded_events)} 个")
        working_events = expanded_events
    else:
        print("[4/7] 跳过重复事件展开")
        working_events = normalized_events
    print()
    
    merged_groups = []
    if not args.no_merge:
        print("[5/7] 合并疑似重复事件...")
        merger = EventMerger(
            title_similarity_threshold=args.title_similarity,
            require_location_match=True
        )
        
        merged_events, merged_groups = merger.merge_duplicates(working_events)
        
        merged_count = len(working_events) - len(merged_events)
        if merged_count > 0:
            print(f"  合并完成: 合并了 {merged_count} 个事件，共 {len(merged_groups)} 组合并")
            if args.verbose and merged_groups:
                for idx, group in enumerate(merged_groups, 1):
                    if len(group) >= 2:
                        print(f"    组合 {idx}:")
                        for event in group:
                            print(f"      - {event.title} ({event.source_file})")
        else:
            print(f"  合并完成: 未发现需要合并的重复事件")
        
        working_events = merged_events
    else:
        print("[5/7] 跳过重复事件合并")
    print()
    
    print("[6/7] 检测冲突...")
    detector = ConflictDetector(
        commute_buffer_minutes=args.commute_buffer
    )
    
    conflicts = detector.detect_all(working_events)
    
    error_conflicts = [c for c in conflicts if c.severity == 'error']
    warning_conflicts = [c for c in conflicts if c.severity == 'warning']
    info_conflicts = [c for c in conflicts if c.severity == 'info']
    
    print(f"  检测完成:")
    print(f"    - 严重错误: {len(error_conflicts)}")
    print(f"    - 警告: {len(warning_conflicts)}")
    print(f"    - 提示: {len(info_conflicts)}")
    
    if args.verbose and conflicts:
        print()
        print("  冲突详情:")
        for idx, c in enumerate(conflicts, 1):
            severity_icon = "🔴" if c.severity == "error" else "🟡" if c.severity == "warning" else "ℹ️"
            print(f"    {severity_icon} [{idx}] {c.description}")
    print()
    
    print("[7/7] 导出结果...")
    
    os.makedirs(args.output, exist_ok=True)
    
    ics_exporter = ICSExporter()
    ics_path = os.path.join(args.output, 'clean.ics')
    ics_exporter.export(working_events, ics_path)
    print(f"  ✓ 已导出: {ics_path}")
    
    csv_exporter = CSVConflictExporter()
    
    conflicts_path = os.path.join(args.output, 'conflicts.csv')
    csv_exporter.export_conflicts(conflicts, conflicts_path)
    print(f"  ✓ 已导出: {conflicts_path}")
    
    if parse_errors:
        errors_path = os.path.join(args.output, 'parse_errors.csv')
        csv_exporter.export_validation_errors(parse_errors, errors_path)
        print(f"  ✓ 已导出: {errors_path}")
    
    report_exporter = ReportExporter()
    
    report_md_path = os.path.join(args.output, 'report.md')
    report_exporter.export_markdown(
        working_events,
        conflicts,
        parse_errors,
        merged_groups,
        schedule_files,
        report_md_path
    )
    print(f"  ✓ 已导出: {report_md_path}")
    
    report_html_path = os.path.join(args.output, 'report.html')
    report_exporter.export_html(
        working_events,
        conflicts,
        parse_errors,
        merged_groups,
        schedule_files,
        report_html_path
    )
    print(f"  ✓ 已导出: {report_html_path}")
    
    print()
    print("=" * 60)
    print("处理完成!")
    print("=" * 60)
    print()
    print("统计摘要:")
    print(f"  - 源文件数: {len(schedule_files)}")
    print(f"  - 清理后事件数: {len(working_events)}")
    print(f"  - 合并事件组数: {len(merged_groups)}")
    print(f"  - 检测到冲突: {len(conflicts)}")
    print(f"  - 解析错误/警告: {len(parse_errors)}")
    print()
    print("输出文件:")
    print(f"  - clean.ics: 清理后的日程文件，可直接导入日历应用")
    print(f"  - conflicts.csv: 冲突明细表格")
    if parse_errors:
        print(f"  - parse_errors.csv: 解析错误明细")
    print(f"  - report.md: Markdown 格式报告")
    print(f"  - report.html: HTML 格式报告")
    print()
    print(f"所有文件已导出至: {os.path.abspath(args.output)}")


if __name__ == '__main__':
    main()
