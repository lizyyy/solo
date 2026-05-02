#!/usr/bin/env python
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

setup(
    name="alkcalc",
    version="0.1.0",
    description="水质碱度滴定计算命令行工具",
    author="水质采样小组",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "numpy>=1.20.0",
        "scipy>=1.7.0",
        "pandas>=1.3.0",
    ],
    entry_points={
        "console_scripts": [
            "alkcalc=alkcalc.cli:main",
        ],
    },
    python_requires=">=3.8",
)
