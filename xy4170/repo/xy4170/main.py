#!/usr/bin/env python3
"""烧成曲线复核器 - 入口脚本"""

import sys
from pathlib import Path

src_path = Path(__file__).parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from kiln_curve_validator.cli import main

if __name__ == "__main__":
    main()
