#!/usr/bin/env python3
"""创建测试用归档包"""

import zipfile
import os
from pathlib import Path


def create_test_zip(output_path: str):
    """创建包含各种问题路径的测试zip"""
    
    test_files = [
        ("absolute/root/path.txt", b"content1"),
        ("C:/Windows/path.txt", b"content2"),
        ("file with spaces.txt", b"content3"),
        ("file\u3000with\u3000chinese.txt", b"content4"),
        ("duplicate.txt", b"dup1"),
        ("subdir/duplicate.txt", b"dup2"),
        ("normal_file.txt", b"normal"),
        ("file<special>:chars?.txt", b"special"),
        ("subdir/nested/file.txt", b"nested"),
    ]
    
    with zipfile.ZipFile(output_path, 'w') as zf:
        for path, content in test_files:
            info = zipfile.ZipInfo(path)
            zf.writestr(info, content)
    
    print(f"测试zip已创建: {output_path}")
    print(f"包含 {len(test_files)} 个测试文件")


if __name__ == "__main__":
    create_test_zip("test_archive.zip")
