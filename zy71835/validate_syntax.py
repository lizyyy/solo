#!/usr/bin/env python3
"""
语法验证脚本 - 快速验证所有Python文件的语法正确性
"""

import os
import sys
import py_compile
from pathlib import Path


def main():
    project_root = Path(__file__).parent
    python_files = list(project_root.rglob("*.py"))
    python_files = [f for f in python_files if "__pycache__" not in str(f)]

    print(f"🔍 正在检查 {len(python_files)} 个 Python 文件的语法...")
    print()

    errors = []
    for i, py_file in enumerate(python_files, 1):
        rel_path = py_file.relative_to(project_root)
        try:
            py_compile.compile(str(py_file), doraise=True)
            print(f"  ✅ {i:3d}. {rel_path}")
        except py_compile.PyCompileError as e:
            errors.append((rel_path, str(e)))
            print(f"  ❌ {i:3d}. {rel_path} - 语法错误")

    print()
    if errors:
        print(f"❌ 发现 {len(errors)} 个语法错误：")
        for path, error in errors:
            print()
            print(f"📄 {path}")
            print(f"   {error}")
        return 1
    else:
        print(f"✅ 所有 {len(python_files)} 个文件语法正确！")
        return 0


if __name__ == "__main__":
    sys.exit(main())
