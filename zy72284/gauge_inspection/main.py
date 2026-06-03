#!/usr/bin/env python3
"""轨道交通限界检查系统 - 主入口

支持三种使用方式：
1. 命令行: python main.py <command>
2. API服务: python main.py serve [--port 5000]
3. Web看板: python main.py web [--port 5000]
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.cli import main as cli_main

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("serve", "web", "api"):
        from src.api import run_server
        port = 5000
        if len(sys.argv) > 2 and sys.argv[2] == "--port":
            port = int(sys.argv[3])
        run_server(port)
    else:
        cli_main()
