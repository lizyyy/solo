#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
热敏标签排版预检台 - 主程序入口
"""

import sys
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from gui.main_window import MainWindow


def main():
    QApplication.setApplicationName("热敏标签排版预检台")
    QApplication.setApplicationVersion("1.0.0")
    QApplication.setOrganizationName("LabelPrecheck")
    
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
