#!/usr/bin/env python
from setuptools import setup, find_packages

setup(
    name="redis-key-analyzer",
    version="0.1.0",
    description="Redis键空间体检CLI工具 - 分析Redis键的TTL、内存使用和前缀归属",
    author="Engineering Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "redis>=4.0.0",
        "pandas>=1.3.0",
        "jinja2>=3.0.0",
        "tqdm>=4.62.0",
        "python-dotenv>=0.19.0",
    ],
    entry_points={
        "console_scripts": [
            "redis-key-analyzer=redis_key_analyzer.cli:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
