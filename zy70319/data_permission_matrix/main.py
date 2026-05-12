#!/usr/bin/env python3
"""
数据权限矩阵CLI - 入口脚本
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cli.main import PermissionCLI

if __name__ == '__main__':
    cli = PermissionCLI()
    cli.run()
