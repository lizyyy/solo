#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="court-evidence-checker",
    version="0.1.0",
    author="Court Clerk Assistant Team",
    description="庭审笔录证据编号校验员 - 法院书记员本地CLI工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "python-dateutil>=2.8.0",
        "pandas>=1.3.0",
        "rich>=10.0.0",
    ],
    extras_require={
        "test": [
            "pytest>=6.0.0",
            "pytest-cov>=2.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "evidence-checker=court_evidence_checker.cli:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Legal Industry",
        "Topic :: Office/Business",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
