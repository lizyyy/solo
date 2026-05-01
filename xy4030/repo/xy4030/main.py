import sys
import os
from PyQt5.QtWidgets import QApplication
from gui.main_window import MainWindow

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("扫描交付质检台")
    app.setStyle('Fusion')
    
    window = MainWindow()
    window.showMaximized()
    
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()
