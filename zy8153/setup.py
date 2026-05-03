#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GNSS 静态观测成果复核工具 - 安装配置"""

from setuptools import setup, find_packages

setup(
    name="gnss-checker",
    version="1.0.0",
    author="GNSS Survey Team",
    description="GNSS 静态观测成果离线复核工具",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "pandas>=1.3.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "gnss-checker=gnss_checker.main:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Topic :: Scientific/Engineering :: GIS",
    ],
)
