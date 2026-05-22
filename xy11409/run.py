#!/usr/bin/env python3
"""项目入口脚本"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pharmacy_expiry_tracker.cli.main import cli

if __name__ == "__main__":
    cli()
