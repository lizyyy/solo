#!/usr/bin/env python3
import py_compile
import os
import sys

errors = []
for root, dirs, files in os.walk("royalty_settlement"):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(root, f)
            try:
                py_compile.compile(path, doraise=True)
                print(f"✓ {path}")
            except py_compile.PyCompileError as e:
                errors.append((path, str(e)))
                print(f"✗ {path}: {e}")

if errors:
    print(f"\n发现 {len(errors)} 个语法错误:")
    for path, err in errors:
        print(f"  {path}: {err}")
    sys.exit(1)
else:
    print("\n✓ 所有Python文件语法正确")
    sys.exit(0)
