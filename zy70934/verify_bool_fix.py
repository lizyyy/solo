#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证脚本：确认布尔值解析修复正确
"""
import sys
sys.path.insert(0, '.')

from app.utils.helpers import parse_bool

test_cases = [
    ("true", True),
    ("True", True),
    ("TRUE", True),
    ("1", True),
    ("yes", True),
    ("是", True),
    ("false", False),
    ("False", False),
    ("FALSE", False),
    ("0", False),
    ("no", False),
    ("否", False),
    ("", False),
    (None, False),
    (True, True),
    (False, False),
    (1, True),
    (0, False),
    (" random ", False),
    (" true ", True),
    (" false ", False),
]

print("=" * 50)
print("布尔值解析验证")
print("=" * 50)

all_passed = True
for input_val, expected in test_cases:
    result = parse_bool(input_val)
    status = "✓" if result == expected else "✗"
    if result != expected:
        all_passed = False
    print(f"{status} parse_bool({repr(input_val):>15}) = {result!r:>5} (期望: {expected!r})")

print("\n" + "=" * 50)
if all_passed:
    print("所有测试用例通过！布尔值解析修复正确。")
else:
    print("部分测试用例失败！")
print("=" * 50)

# 验证导入服务中的使用场景
print("\n" + "=" * 50)
print("模拟整改单导入场景验证")
print("=" * 50)

sample_rows = [
    {"是否返工": "true", "预期": True},
    {"是否返工": "false", "预期": False},
    {"是否返工": "是", "预期": True},
    {"是否返工": "否", "预期": False},
    {"is_rework": "true", "预期": True},
    {"is_rework": "false", "预期": False},
]

all_import_passed = True
for row in sample_rows:
    val = row.get("是否返工") or row.get("is_rework") or False
    result = parse_bool(val)
    expected = row["预期"]
    status = "✓" if result == expected else "✗"
    if result != expected:
        all_import_passed = False
    print(f"{status} 输入={val!r:>10} → 解析结果={result!r:>5} (期望: {expected!r})")

print("\n" + "=" * 50)
if all_import_passed:
    print("整改单导入场景验证通过！\"是否返工=false\"会被正确解析为False。")
else:
    print("整改单导入场景验证失败！")
print("=" * 50)

sys.exit(0 if (all_passed and all_import_passed) else 1)
