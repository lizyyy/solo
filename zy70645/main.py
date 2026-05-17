#!/usr/bin/env python3
"""
水电抄表倍率异常用量缺表提示排查CLI
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from meter_reader.cli import main

if __name__ == "__main__":
    main()
