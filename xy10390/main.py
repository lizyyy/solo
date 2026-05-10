#!/usr/bin/env python3
"""
机房巡检温湿度 CLI 工具
主入口脚本
"""

import sys
from server_room_inspection.cli import main

if __name__ == "__main__":
    sys.exit(main())
