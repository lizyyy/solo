#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
维保照片归档质检台 - 电梯维保班组用本地桌面工具
功能：照片导入、规则校验、人工复核、归档、报告导出
"""

import tkinter as tk
from tkinter import ttk
from gui.main_window import MainWindow


def main():
    """主程序入口"""
    root = tk.Tk()
    app = MainWindow(root)
    root.mainloop()


if __name__ == "__main__":
    main()
