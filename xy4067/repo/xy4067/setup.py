#!/usr/bin/env python
"""
义齿打印交付核对员 - 安装脚本
"""

from setuptools import setup, find_packages

setup(
    name="denture_checker",
    version="1.0.0",
    description="义齿打印交付核对员 - 口腔义齿加工室用本地 Python CLI 工具",
    long_description="""
    义齿打印交付核对员是一个专为口腔义齿加工室设计的本地 Python CLI 工具。
    用于校验义齿订单、模型文件、树脂批号和后处理记录的一致性，
    防止患者编号、牙位、色号、材料或打印批次对不上的问题。
    """,
    author="义齿打印交付核对员",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "denture-checker=denture_checker.cli:cli",
        ],
    },
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Healthcare Industry",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Medical Science Apps",
    ],
    python_requires=">=3.8",
)
