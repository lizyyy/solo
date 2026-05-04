#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多轨素材交付台 - Multi-Track Delivery Desk
一个为播客剪辑师设计的音频素材管理工具
"""

import sys
import os
from pathlib import Path

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from gui.main_window import MainWindow


def main():
    app = QApplication(sys.argv)
    
    app.setApplicationName("多轨素材交付台")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("MultiTrackDelivery")
    
    font = QFont("Microsoft YaHei", 9) if sys.platform == "win32" else QFont("PingFang SC", 13)
    app.setFont(font)
    
    main_window = MainWindow()
    main_window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
