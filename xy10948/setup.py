#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="training-attendance-cli",
    version="1.0.0",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "attendance=attendance_cli.main:main",
        ],
    },
    author="Training Admin",
    description="培训签到补签 CLI - 处理签到机数据与老师补签表的合并与冲突检测",
    python_requires=">=3.7",
)
