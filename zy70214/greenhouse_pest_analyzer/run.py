#!/usr/bin/env python3
"""快速运行脚本 - 温室虫害诱捕分析器"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.main import main

if __name__ == '__main__':
    sys.exit(main())
