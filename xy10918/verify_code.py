#!/usr/bin/env python3
"""
代码验证脚本 - 检查所有模块的语法正确性
"""

import sys
import os

print("=" * 60)
print("农资赊销回款API - 代码验证")
print("=" * 60)

modules = [
    "app.database",
    "app.models",
    "app.schemas",
    "app.services",
    "app.main",
    "init_sample_data",
    "httpx"
]

all_passed = True
for module in modules:
    try:
        __import__(module)
        print(f"✓ {module} 加载成功")
    except Exception as e:
        print(f"✗ {module} 加载失败: {e}")
        all_passed = False

print("\n" + "=" * 60)
if all_passed:
    print("✓ 所有代码模块验证通过!")
    print("\n下一步操作:")
    print("1. 初始化样例数据: python init_sample_data.py")
    print("2. 启动API服务:     python -m uvicorn app.main:app --reload")
    print("3. 访问API文档:      http://localhost:8000/docs")
    print("4. 运行自检测试:     python test_api.py")
else:
    print("✗ 部分模块验证失败, 请检查代码!")
print("=" * 60)

sys.exit(0 if all_passed else 1)
