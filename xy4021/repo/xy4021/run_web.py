#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import DatabaseConnection
from database.schema import DatabaseSchema


def check_database_setup():
    print("正在初始化数据库...")
    DatabaseSchema.initialize()
    DatabaseSchema.seed_default_data()
    print("数据库初始化完成")


def main():
    check_database_setup()
    
    from webapp.app import app
    
    print("=" * 60)
    print("  器械包追踪台 - Web版")
    print("  口腔诊所消毒管理系统")
    print("=" * 60)
    print()
    print("  请在浏览器中打开以下地址:")
    print("  http://localhost:5001")
    print()
    print("  按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()
    
    app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=False)


if __name__ == '__main__':
    main()
