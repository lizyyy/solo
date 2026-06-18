#!/usr/bin/env python3
"""浮标海况数据清洗 - 一键运行脚本

运营主管直接运行此文件即可完成完整演示流程
"""
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from buoy_cleaner.cli import main

if __name__ == '__main__':
    print("=" * 60)
    print("  浮标海况数据清洗系统")
    print("  海洋站值班专用")
    print("=" * 60)
    print()

    if len(sys.argv) == 1:
        print("使用方法:")
        print("  python run_demo.py demo                # 一键演示完整流程")
        print("  python run_demo.py import_data <文件>  # 导入数据")
        print("  python run_demo.py pending             # 查看待确认记录")
        print("  python run_demo.py confirm ...         # 人工确认记录")
        print("  python run_demo.py export <文件>       # 导出结果")
        print("  python run_demo.py status              # 查看系统状态")
        print("  python run_demo.py reset               # 重置数据")
        print()
        print("快速开始（首次使用）:")
        print("  python run_demo.py demo")
        print()
        sys.argv.append('demo')

    main()
