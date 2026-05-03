#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕交付质检台 - 主程序入口
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from gui.main_gui import run_app


if __name__ == "__main__":
    run_app()
