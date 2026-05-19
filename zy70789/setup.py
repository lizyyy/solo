#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="binary_scanner",
    version="1.0.0",
    description="Binary File Signature Hash Risk Scan CLI",
    author="Security Team",
    packages=find_packages(),
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "binary-scanner = binary_scanner.cli.main:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
