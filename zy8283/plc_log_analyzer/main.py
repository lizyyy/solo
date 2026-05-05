#!/usr/bin/env python3
"""
PLC 日志分析工具 - 工厂设备运维夜班日志整理工具

功能:
- 解析多种格式的日志文件 (.log, .txt, .jsonl)
- 支持 YAML 配置的正则模板系统
- 抽取时间、设备号、级别、错误码、批次号等信息
- 分析并生成事件汇总报告
- 归档无法匹配的坏行
"""

import argparse
import os
import sys
from pathlib import Path
from typing import List

from .config_loader import load_config, ConfigLoader
from .parser import LogParser, ParsedLogLine
from .analyzer import LogAnalyzer, archive_bad_lines
from .reporter import generate_incident_summary


def find_log_files(input_path: str) -> List[str]:
    input_path = Path(input_path)
    log_files = []
    
    if input_path.is_file():
        log_files.append(str(input_path))
    elif input_path.is_dir():
        for ext in ["*.log", "*.txt", "*.jsonl"]:
            log_files.extend([str(f) for f in input_path.glob(ext)])
            log_files.extend([str(f) for f in input_path.glob(f"**/{ext}")])
    
    return sorted(set(log_files))


def run_analyze(args):
    print("=" * 60)
    print("PLC 日志分析工具")
    print("=" * 60)
    print()
    
    input_path = args.input or "samples"
    config_path = args.config or "config/templates.yaml"
    output_dir = args.output or "."
    archive_dir = args.archive or "archive"
    
    input_path = Path(input_path)
    config_path = Path(config_path)
    output_dir = Path(output_dir)
    archive_dir = Path(archive_dir)
    
    print(f"[配置] 输入路径: {input_path}")
    print(f"[配置] 配置文件: {config_path}")
    print(f"[配置] 输出目录: {output_dir}")
    print(f"[配置] 归档目录: {archive_dir}")
    print()
    
    if not input_path.exists():
        print(f"错误: 输入路径不存在: {input_path}")
        sys.exit(1)
    
    if not config_path.exists():
        print(f"错误: 配置文件不存在: {config_path}")
        sys.exit(1)
    
    print("[1/5] 加载配置文件...")
    try:
        templates = load_config(str(config_path))
        print(f"      已加载 {len(templates)} 个模板:")
        for t in templates:
            print(f"        - {t['name']}: {t['description']}")
    except Exception as e:
        print(f"错误: 加载配置失败: {e}")
        sys.exit(1)
    print()
    
    print("[2/5] 查找日志文件...")
    log_files = find_log_files(str(input_path))
    if not log_files:
        print("警告: 未找到任何日志文件 (.log, .txt, .jsonl)")
        print("请检查输入路径或使用 -i 参数指定正确的目录")
        sys.exit(0)
    
    print(f"      找到 {len(log_files)} 个日志文件:")
    for f in log_files:
        print(f"        - {f}")
    print()
    
    print("[3/5] 解析日志文件...")
    parser = LogParser(templates)
    all_parsed_lines: List[ParsedLogLine] = []
    
    for log_file in log_files:
        try:
            lines = parser.parse_file(log_file)
            all_parsed_lines.extend(lines)
            print(f"      已解析 {log_file}: {len(lines)} 行")
        except Exception as e:
            print(f"警告: 解析文件 {log_file} 失败: {e}")
    
    if not all_parsed_lines:
        print("错误: 未能解析任何日志行")
        sys.exit(1)
    
    print(f"      总计解析 {len(all_parsed_lines)} 行")
    print()
    
    print("[4/5] 分析日志...")
    analyzer = LogAnalyzer(timezone_offset=args.timezone or 8)
    bad_lines, stats = analyzer.analyze(all_parsed_lines)
    
    incidents_summary = analyzer.get_incidents_summary()
    
    print(f"      统计信息:")
    print(f"        - 总行数: {stats['total_lines']}")
    print(f"        - 有效行: {stats['valid_lines']}")
    print(f"        - 坏行: {stats['bad_lines']}")
    print(f"        - 涉及设备: {len(stats['devices'])} 个")
    print(f"        - 发现错误码: {len(stats['error_codes'])} 个")
    print(f"        - 事件总数: {incidents_summary.get('total_incidents', 0)} 个")
    print()
    
    print("[5/5] 生成输出文件...")
    archive_path = archive_dir / "bad-lines.jsonl"
    bad_count = 0
    if bad_lines:
        try:
            bad_count = archive_bad_lines(bad_lines, str(archive_path))
            print(f"      坏行已归档: {archive_path} ({bad_count} 行)")
        except Exception as e:
            print(f"警告: 归档坏行失败: {e}")
    else:
        print(f"      无坏行需要归档")
    
    report_path = output_dir / "incident_summary.md"
    try:
        generate_incident_summary(
            stats=stats,
            incidents_summary=incidents_summary,
            bad_lines_count=bad_count,
            archive_path=str(archive_path),
            output_path=str(report_path),
        )
        print(f"      报告已生成: {report_path}")
    except Exception as e:
        print(f"错误: 生成报告失败: {e}")
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("分析完成!")
    print("=" * 60)
    print()
    print(f"报告位置: {report_path.absolute()}")
    if bad_count > 0:
        print(f"坏行归档: {archive_path.absolute()}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="PLC 日志分析工具 - 工厂设备运维夜班日志整理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用默认配置分析 samples 目录
  python -m plc_log_analyzer analyze
  
  # 指定输入目录和输出位置
  python -m plc_log_analyzer analyze -i /path/to/logs -o ./output
  
  # 使用自定义配置文件
  python -m plc_log_analyzer analyze -c my_templates.yaml
        """,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    analyze_parser = subparsers.add_parser("analyze", help="分析日志文件并生成报告")
    analyze_parser.add_argument(
        "-i", "--input",
        help="输入路径 (文件或目录，默认: samples)",
        default=None,
    )
    analyze_parser.add_argument(
        "-c", "--config",
        help="配置文件路径 (默认: config/templates.yaml)",
        default=None,
    )
    analyze_parser.add_argument(
        "-o", "--output",
        help="输出目录 (默认: 当前目录)",
        default=None,
    )
    analyze_parser.add_argument(
        "-a", "--archive",
        help="坏行归档目录 (默认: archive)",
        default=None,
    )
    analyze_parser.add_argument(
        "-t", "--timezone",
        type=int,
        help="时区偏移 (小时，默认: 8 表示 UTC+8)",
        default=8,
    )
    
    args = parser.parse_args()
    
    if args.command == "analyze":
        run_analyze(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
