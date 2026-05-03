#!/usr/bin/env python3
"""
冰箱样本温控交接台 - 医院检验科夜班专用离线工具
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.gui.main_window import run_gui


def main():
    print("=" * 50)
    print("  冰箱样本温控交接台 v1.0.0")
    print("  医院检验科夜班专用离线工具")
    print("=" * 50)
    print("")
    print("功能说明:")
    print("  1. 导入三类数据: 扫码枪CSV、温度记录JSON、交接表CSV")
    print("  2. 自动检测: 超时离柜、温度越界、架位冲突、缺签")
    print("  3. 值班备注持久化存储")
    print("  4. 导出: Markdown交接单、CSV风险清单")
    print("")
    print("正在启动GUI界面...")
    
    run_gui()


if __name__ == "__main__":
    main()
