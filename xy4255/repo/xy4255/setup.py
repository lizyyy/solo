#!/usr/bin/env python3
"""Setup script for titration-tool."""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="titration-tool",
    version="0.1.0",
    author="Teaching Lab",
    author_email="lab@university.edu",
    description="酸碱滴定数据处理CLI工具 - 支持数据导入、拟合、缓冲液配方计算和报告导出",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-university/titration-tool",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Education",
        "Topic :: Scientific/Engineering :: Chemistry",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "numpy>=1.20.0",
        "scipy>=1.7.0",
        "pandas>=1.3.0",
        "matplotlib>=3.4.0",
    ],
    entry_points={
        "console_scripts": [
            "titration=titration_tool.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "titration_tool": ["examples/*.csv"],
    },
)
