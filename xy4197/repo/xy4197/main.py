"""快捷键冲突搬家员 - 主入口"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.gui.main_window import main as gui_main


def main():
    """主函数"""
    print("=" * 50)
    print("快捷键冲突搬家员")
    print("Shortcut Conflict Migrator")
    print("=" * 50)
    print()
    print("启动图形界面...")
    print()
    
    # 启动GUI
    gui_main()


if __name__ == "__main__":
    main()
