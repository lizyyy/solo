#!/usr/bin/env python3
"""二手车拍卖保证金风控复核系统 - 主入口"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.cli import main

if __name__ == "__main__":
    main()
