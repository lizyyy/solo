#!/usr/bin/env python3
"""实验室值班预约检查工具入口脚本"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from lab_scheduler.cli import main

if __name__ == "__main__":
    sys.exit(main())
