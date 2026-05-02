#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
无线麦频率彩排台 - 主入口文件
"""

import sys
from PyQt6.QtWidgets import QApplication
from src.main_gui import WirelessMicMainWindow

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("无线麦频率彩排台")
    app.setApplicationDisplayName("无线麦频率彩排台")
    
    window = WirelessMicMainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
