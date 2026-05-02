#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
管网漏点夜巡拼图器 - 城市供水抢修班专用命令行工具

功能：
- init: 初始化管网节点、阀门和传感器配置
- import: 读取多源CSV数据
- analyze: 时间轴对齐、压力骤降识别、声纹分析、传播延迟计算
- plan: 漏点定位、关阀计划、受影响用户清单
- review: 人工复核保存
- report: 导出Markdown、CSV、JSON报告
"""

import argparse
import sys
from pathlib import Path

from pipe_leak_puzzle.cli import main as cli_main
from pipe_leak_puzzle import __version__


def main():
    parser = argparse.ArgumentParser(
        prog="pipe-leak-puzzle",
        description="管网漏点夜巡拼图器 - 城市供水抢修班专用命令行工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  pipe-leak-puzzle init --output ./my-project
  pipe-leak-puzzle import ./my-project --pressure pressure.csv --acoustic acoustic.csv --valve valve.csv
  pipe-leak-puzzle analyze ./my-project
  pipe-leak-puzzle plan ./my-project
  pipe-leak-puzzle review ./my-project --confirm
  pipe-leak-puzzle report ./my-project --format all
        """
    )
    parser.add_argument("-v", "--version", action="version", version=f"%(prog)s {__version__}")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # init 命令
    init_parser = subparsers.add_parser("init", help="初始化管网配置项目")
    init_parser.add_argument("output", type=Path, help="项目输出目录路径")
    init_parser.add_argument("--template", type=str, default="default",
                           choices=["default", "small", "large"],
                           help="管网模板类型 (default: default)")
    
    # import 命令
    import_parser = subparsers.add_parser("import", help="导入多源CSV数据")
    import_parser.add_argument("project", type=Path, help="项目目录路径")
    import_parser.add_argument("--pressure", type=Path, help="压力传感器CSV文件")
    import_parser.add_argument("--acoustic", type=Path, help="听漏仪巡检CSV文件")
    import_parser.add_argument("--valve", type=Path, help="阀门台账CSV文件")
    import_parser.add_argument("--flow", type=Path, help="流量数据CSV文件")
    
    # analyze 命令
    analyze_parser = subparsers.add_parser("analyze", help="时序分析：时间对齐、异常检测")
    analyze_parser.add_argument("project", type=Path, help="项目目录路径")
    analyze_parser.add_argument("--pressure-threshold", type=float, default=0.15,
                               help="压力骤降阈值 (0-1, default: 0.15)")
    analyze_parser.add_argument("--acoustic-threshold", type=float, default=0.7,
                               help="声纹异常阈值 (0-1, default: 0.7)")
    analyze_parser.add_argument("--time-window", type=int, default=300,
                               help="时间对齐窗口(秒, default: 300)")
    
    # plan 命令
    plan_parser = subparsers.add_parser("plan", help="漏点定位与关阀计划")
    plan_parser.add_argument("project", type=Path, help="项目目录路径")
    plan_parser.add_argument("--isolation-strategy", type=str, default="minimal",
                             choices=["minimal", "conservative", "aggressive"],
                             help="隔离策略 (default: minimal)")
    
    # review 命令
    review_parser = subparsers.add_parser("review", help="人工复核与确认")
    review_parser.add_argument("project", type=Path, help="项目目录路径")
    review_parser.add_argument("--confirm", action="store_true", help="确认漏点分析结果")
    review_parser.add_argument("--reject", action="store_true", help="拒绝漏点分析结果")
    review_parser.add_argument("--notes", type=str, help="复核备注")
    review_parser.add_argument("--adjust-leak-location", type=str, help="调整后的漏点位置")
    
    # report 命令
    report_parser = subparsers.add_parser("report", help="导出分析报告")
    report_parser.add_argument("project", type=Path, help="项目目录路径")
    report_parser.add_argument("--format", type=str, default="markdown",
                              choices=["markdown", "csv", "json", "all"],
                              help="报告格式 (default: markdown)")
    report_parser.add_argument("--output", type=Path, help="报告输出目录")
    
    # self-test 命令
    selftest_parser = subparsers.add_parser("self-test", help="运行自检程序")
    selftest_parser.add_argument("--output", type=Path, default=Path("./self-test-output"),
                                 help="自检输出目录")
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(0)
    
    try:
        cli_main(args)
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
