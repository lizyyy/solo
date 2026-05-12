#!/usr/bin/env python3
"""
数据库迁移前置检查工具入口脚本

使用方法:
    python db_checker.py --migration-dir ./migrations check
"""

from db_migration_checker.cli import main

if __name__ == '__main__':
    main()
