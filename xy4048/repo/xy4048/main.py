#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冷藏药品交接温控追溯台
======================

一个用于医院药房和社区配送员管理冷藏药品配送的桌面GUI应用。

功能特点:
- 三栏式界面：左侧维护基础数据、中间任务看板、右侧任务详情
- 温度记录仪CSV导入与多规则校验
- 任务状态机：待装箱→运输中→待签收→需复核→已归档
- 超温自动检测与复核触发
- 附件SHA256哈希完整性校验
- 审计包生成与多种格式导出

作者: 冷链追溯系统团队
版本: 1.0.0
"""

import sys
import os
from pathlib import Path

project_root = Path(__file__).parent.resolve()
sys.path.insert(0, str(project_root))


def check_dependencies():
    missing = []
    
    try:
        import customtkinter
    except ImportError:
        missing.append("customtkinter")
    
    try:
        import matplotlib
    except ImportError:
        missing.append("matplotlib")
    
    try:
        import pandas
    except ImportError:
        missing.append("pandas")
    
    try:
        import PIL
    except ImportError:
        missing.append("Pillow")
    
    if missing:
        print("=" * 60)
        print("错误: 缺少必要的依赖包")
        print("=" * 60)
        print("\n请运行以下命令安装依赖:")
        print(f"\n  pip install -r requirements.txt")
        print(f"\n或者单独安装:")
        for pkg in missing:
            print(f"  pip install {pkg}")
        print("\n" + "=" * 60)
        sys.exit(1)
    
    return True


def main():
    check_dependencies()
    
    from gui.main_window import MainWindow
    
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
