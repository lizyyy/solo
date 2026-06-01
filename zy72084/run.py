#!/usr/bin/env python3
"""
3D网格孔洞面积估算工具入口
直接运行: python run.py --help
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.cli import main

if __name__ == "__main__":
    sys.exit(main())
