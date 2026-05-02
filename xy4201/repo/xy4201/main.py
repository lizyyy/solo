#!/usr/bin/env python3
"""
窑烧曲线复盘台 - 陶艺工作室窑烧数据管理与分析工具
"""

import tkinter as tk
from gui.main_window import MainWindow

def main():
    """主函数"""
    root = tk.Tk()
    app = MainWindow(root)
    root.mainloop()

if __name__ == "__main__":
    main()
