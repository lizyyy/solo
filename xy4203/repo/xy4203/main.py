#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复前后影像比对台 - 古籍修复质量管控系统
"""

import tkinter as tk
from tkinter import ttk, messagebox

from gui.main_window import MainWindow


def main():
    """主函数，启动应用程序"""
    try:
        root = tk.Tk()
        app = MainWindow(root)
        root.mainloop()
    except Exception as e:
        messagebox.showerror("错误", f"应用程序启动失败: {e}")
        raise


if __name__ == "__main__":
    main()
