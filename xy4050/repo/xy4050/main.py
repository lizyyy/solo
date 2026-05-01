#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应急演练观察合并台
用于整合和分析消防疏散、反恐演练等应急事件记录的桌面应用。
"""

import sys
from pathlib import Path

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("应急演练观察合并台")
    app.setApplicationVersion("1.0.0")
    app.setStyle('Fusion')
    
    from config import APP_NAME, APP_VERSION
    print(f"启动 {APP_NAME} v{APP_VERSION}...")
    
    from gui.main_window import MainWindow
    window = MainWindow()
    window.show()
    
    print("应用已启动")
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
