#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕质检桌面工具
用于检查字幕文件中的各种问题：重叠时间、字数过高、空字幕、说话人缺失、敏感词命中
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import sys

# 导入模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.parser import SubtitleParser, SegmentsParser, ConfigParser
from modules.rules_engine import RulesEngine
from modules.state_storage import StateStorage
from modules.gui import SubtitleQAApp
from modules.exporter import Exporter


def main():
    """主函数"""
    root = tk.Tk()
    app = SubtitleQAApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
