#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="firmware-gray-release",
    version="0.1.0",
    author="Your Name",
    author_email="your@email.com",
    description="固件灰度放行员 - 离线巡检平板固件升级管理工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "pandas>=1.5.0",
    ],
    entry_points={
        "console_scripts": [
            "firmware-ga = firmware_ga.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.8',
)
