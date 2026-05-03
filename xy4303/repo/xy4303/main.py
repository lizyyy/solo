#!/usr/bin/env python3
"""
取模返工复核台 - 牙科义齿加工所前台管理系统
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gui.app import ReviewWorkbenchApp

def main():
    """主程序入口"""
    app = ReviewWorkbenchApp()
    app.run()

if __name__ == "__main__":
    main()
