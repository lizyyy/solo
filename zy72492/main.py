#!/usr/bin/env python3
"""街道家具破损派单系统 - 主入口"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'web':
        from app.web import create_app
        app = create_app()
        print("🌐 启动小看板: http://localhost:8765")
        print("   访问上面的地址查看Web界面")
        app.run(debug=True, host='0.0.0.0', port=8765)
    else:
        from app.cli import cli
        cli()


if __name__ == '__main__':
    main()
