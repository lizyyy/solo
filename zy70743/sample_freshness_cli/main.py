#!/usr/bin/env python3
"""开发门户样例保鲜运行检查排查CLI
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cli.commands import cli

if __name__ == '__main__':
    cli()
