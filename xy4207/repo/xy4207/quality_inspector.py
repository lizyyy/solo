#!/usr/bin/env python3
"""
客服回访录音质检工具
用于批量处理客服回访录音的文字稿，进行质检分析并生成报告。
"""

import os
import sys

# 添加当前目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from quality_inspector.cli import main

if __name__ == "__main__":
    main()
