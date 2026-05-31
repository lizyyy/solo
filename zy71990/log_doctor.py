#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日志目录体检工具 - 运维小工具
功能：目录快照 + 配置文件 + 失败日志 = 统一时间线查看
"""

import os
import sys
import argparse
from datetime import datetime

from src.snapshot import DirectorySnapshot
from src.config_parser import ConfigParser
from src.log_parser import FailureLogParser
from src.timeline import Timeline
from src.doctor import LogDoctor
from src.history import ChangeHistory


def main():
    parser = argparse.ArgumentParser(
        description='日志目录体检工具 - 让运维同事愿意跑的小工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python log_doctor.py check ./logs                  # 做一次完整体检
  python log_doctor.py snapshot ./logs               # 只拍目录快照
  python log_doctor.py timeline ./logs               # 看统一时间线
  python log_doctor.py history ./logs/fail.log       # 看日志修改历史
        """
    )
    parser.add_argument('command', choices=['check', 'snapshot', 'timeline', 'history'],
                        help='操作命令')
    parser.add_argument('path', help='目标目录或文件路径')
    parser.add_argument('--config', default=None, help='配置文件路径（可选）')
    parser.add_argument('--output', default=None, help='输出目录（可选）')
    
    args = parser.parse_args()
    
    base_path = os.path.abspath(args.path)
    output_dir = args.output or os.path.join(os.getcwd(), 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    if args.command == 'check':
        print("🔍 开始日志目录体检...")
        doctor = LogDoctor(base_path, args.config, output_dir)
        report = doctor.run_check()
        doctor.print_report(report)
        doctor.save_report(report)
        
    elif args.command == 'snapshot':
        print("📸 拍摄目录快照...")
        snapshot = DirectorySnapshot(base_path)
        result = snapshot.take()
        snapshot.print_result(result)
        snapshot.save(result, output_dir)
        
    elif args.command == 'timeline':
        print("📊 生成统一时间线...")
        timeline = Timeline(base_path, args.config)
        events = timeline.build()
        timeline.print_events(events)
        timeline.save(events, output_dir)
        
    elif args.command == 'history':
        if not os.path.isfile(args.path):
            print("❌ 请指定要查看历史的日志文件路径")
            sys.exit(1)
        print("📜 查看文件修改历史...")
        history = ChangeHistory(os.path.dirname(args.path))
        records = history.get_history(os.path.basename(args.path))
        history.print_history(records)


if __name__ == '__main__':
    main()
