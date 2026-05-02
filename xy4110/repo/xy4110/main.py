"""
合唱排练座位编排器
社区合唱团排练座位编排工具
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from chorus_planner.gui.main_window import MainWindow


def main():
    """主入口函数"""
    app = QApplication(sys.argv)
    
    app.setApplicationName("合唱排练座位编排器")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("ChorusPlanner")
    
    font = QFont("Microsoft YaHei", 10)
    app.setFont(font)
    
    app.setStyle("Fusion")
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
