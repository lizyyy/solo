#!/usr/bin/env python3
"""
快速测试脚本
"""

import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from change_correlator.cli import main

if __name__ == "__main__":
    sys.exit(main())
