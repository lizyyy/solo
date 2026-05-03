#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条款红线落点器 - 法务合同盖章前复核工具
"""

import tkinter as tk
from gui.app import ClauseRedlineApp

def main():
    """主函数"""
    root = tk.Tk()
    app = ClauseRedlineApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
