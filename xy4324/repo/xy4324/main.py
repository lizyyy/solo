#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
试剂领用安全闸 - 中学化学实验室试剂管理系统
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sqlite3
import os
from datetime import datetime

from database import init_database, get_db
from ui.main_window import MainWindow
from config import Config, get_config

def ensure_data_directory():
    """确保数据目录存在"""
    data_dir = get_config().data_dir
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

def main():
    """主程序入口"""
    print("正在启动 试剂领用安全闸...")
    
    # 确保数据目录
    ensure_data_directory()
    
    # 初始化数据库
    print("正在初始化数据库...")
    init_database()
    
    # 创建主窗口
    print("正在创建主界面...")
    root = tk.Tk()
    
    # 设置窗口标题和大小
    root.title("试剂领用安全闸 - 中学化学实验室管理系统")
    root.geometry("1200x800")
    root.minsize(1000, 700)
    
    # 设置窗口图标（如果有的话）
    try:
        # 这里可以设置图标，暂时跳过
        pass
    except:
        pass
    
    # 初始化主窗口
    app = MainWindow(root)
    
    print("系统启动完成！")
    root.mainloop()

if __name__ == "__main__":
    main()
