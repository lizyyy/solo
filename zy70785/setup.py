#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="backup-manifest-checker",
    version="1.0.0",
    description="备份Manifest校验排查CLI工具",
    author="Backup Checker Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "rich>=12.0.0",
    ],
    entry_points={
        "console_scripts": [
            "bmcheck=backup_manifest_checker.cli.main:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: System Administrators",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
