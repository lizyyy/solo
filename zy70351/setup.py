#!/usr/bin/env python3
"""API 访问密钥风控 CLI - 安装配置"""

from setuptools import setup, find_packages

setup(
    name="api-key-risk",
    version="1.0.0",
    description="API 访问密钥风控 CLI - 识别密钥泄露和异常访问",
    author="Risk Management Team",
    packages=find_packages(),
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "api-risk=api_key_risk.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Information Technology",
        "Topic :: Security",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
