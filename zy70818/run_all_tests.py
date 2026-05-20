#!/usr/bin/env python3
"""运行所有测试"""

import sys
import subprocess

print("=" * 60)
print("口腔连锁对账服务 - 完整测试套件")
print("=" * 60)

tests = [
    ("数据导入测试", "tests/test_import.py"),
    ("对账功能测试", "tests/test_reconciliation.py"),
    ("数量平衡测试", "tests/test_quantity_balance.py"),
    ("复核同步测试", "tests/test_review_sync.py"),
    ("报告生成测试", "tests/test_report.py"),
    ("API接口测试", "tests/test_api.py"),
]

for name, path in tests:
    print(f"\n{'=' * 60}")
    print(f"运行: {name}")
    print("=" * 60)
    result = subprocess.run([sys.executable, path], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("错误信息:")
        print(result.stderr)

print("\n" + "=" * 60)
print("所有测试执行完成!")
print("=" * 60)
