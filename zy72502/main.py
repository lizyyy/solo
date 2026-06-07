#!/usr/bin/env python3
"""
合同条款抽取复核工具 - 主入口
支持命令行、API服务器、小看板三种模式
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "cli"

    if mode == "web" or mode == "api":
        from contract_review.api.server import app
        print("🌐 启动小看板和API服务: http://localhost:5000")
        print("   命令行模式: python main.py cli --help")
        app.run(host="0.0.0.0", port=5000, debug=True)
    elif mode == "cli":
        from contract_review.cli.main import cli
        cli(sys.argv[2:])
    else:
        print("用法:")
        print("  python main.py cli       # 命令行模式 (默认)")
        print("  python main.py web       # 启动小看板和API服务器")
        print("  python main.py cli --help  # 查看命令行帮助")
