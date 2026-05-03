#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
危化品柜巡检签收台 - 主入口
"""

import sys
import os
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

from gui.main_window import MainWindow
from storage.db_manager import DatabaseManager
from sample_data import add_sample_data


def setup_database():
    """初始化数据库"""
    db_manager = DatabaseManager()
    db_manager.initialize_database()
    return db_manager


def main():
    """应用主函数"""
    # 创建应用实例
    app = QApplication(sys.argv)
    
    # 设置应用信息
    app.setApplicationName("危化品柜巡检签收台")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("校园实验室")
    
    # 设置默认字体
    font = QFont("Microsoft YaHei", 10)
    app.setFont(font)
    
    # 设置样式
    app.setStyle("Fusion")
    
    # 初始化数据库
    db_manager = setup_database()
    
    # 添加示例数据（如果是首次运行）
    add_sample_data(db_manager)
    
    # 创建主窗口
    main_window = MainWindow(db_manager)
    main_window.show()
    
    # 运行应用
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
