#!/usr/bin/env python3
"""标本流转防错台主程序入口"""

import sys
from pathlib import Path

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

from specimen_tracker.gui import MainWindow
from specimen_tracker.database import DatabaseManager


def main():
    """启动应用程序"""
    
    app = QApplication(sys.argv)
    app.setApplicationName("标本流转防错台")
    app.setApplicationVersion("1.0.0")
    app.setStyle("Fusion")
    
    db_path = Path.home() / ".specimen_tracker" / "specimens.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    db_manager = DatabaseManager(str(db_path))
    db_manager.initialize_database()
    
    window = MainWindow(db_manager)
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
