#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
救生员盲区排查系统
用于给公共泳馆馆长排查救生员盯防盲区的桌面GUI工具
"""

import sys
import os

def check_dependencies():
    missing = []
    try:
        import yaml
    except ImportError:
        missing.append('pyyaml')
    
    if missing:
        print("缺少必需的依赖包，请安装:")
        print(f"  pip install {' '.join(missing)}")
        sys.exit(1)

def main():
    check_dependencies()
    
    from modules.gui import run_app
    run_app()

if __name__ == '__main__':
    main()
