#!/usr/bin/env python3
"""
发票 OCR 置信度复核系统 - 快捷入口脚本
直接运行: python ocr_review.py demo
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from ocr_review.cli.main import main

if __name__ == "__main__":
    main()
