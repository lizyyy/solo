#!/usr/bin/env python3
"""快捷键冲突搬家员 - 桌面GUI工具
用于帮助设计团队在换电脑前管理和迁移快捷键配置
"""

from setuptools import setup, find_packages

setup(
    name="shortcut-conflict-migrator",
    version="1.0.0",
    description="快捷键冲突搬家员 - 管理和迁移快捷键配置的桌面GUI工具",
    author="快捷键冲突搬家员团队",
    packages=find_packages(),
    install_requires=[
        # 所有依赖都是Python标准库
    ],
    entry_points={
        "console_scripts": [
            "shortcut-migrator=src.gui.main_window:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Desktop Environment",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)
