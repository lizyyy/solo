#!/usr/bin/env python3
"""
矫形取模适配台 - 假肢矫形门诊与制作间管理系统
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QFont

from config.settings import get_settings
from ui.main_window import MainWindow


def main():
    settings = get_settings()
    
    app = QApplication(sys.argv)
    app.setApplicationName(settings.app_name)
    app.setApplicationVersion(settings.app_version)
    app.setStyle("Fusion")
    
    font = QFont("Microsoft YaHei", 10)
    app.setFont(font)
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
