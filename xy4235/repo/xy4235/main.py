#!/usr/bin/env python3
"""
麻醉监护复盘板 - 宠物医院麻醉护士专用工具
"""
import sys
import os

# 将src目录添加到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from PyQt5.QtWidgets import QApplication
from gui.main_window import MainWindow

def main():
    """
    应用程序主入口
    """
    app = QApplication(sys.argv)
    
    # 设置应用程序信息
    app.setApplicationName("麻醉监护复盘板")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("PetHospital")
    
    # 创建主窗口
    window = MainWindow()
    window.show()
    
    # 运行应用程序
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
