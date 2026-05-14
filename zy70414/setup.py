#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="env-snapshot",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "typer>=0.9.0",
        "rich>=13.0.0",
        "sqlalchemy>=2.0.0",
        "python-dotenv>=1.0.0",
        "cryptography>=41.0.0",
    ],
    entry_points={
        "console_scripts": [
            "env-snapshot=env_snapshot.cli:main",
        ],
    },
    author="Your Name",
    description="环境变量快照命令行工具",
    keywords="env, snapshot, signature, compliance",
    python_requires=">=3.8",
)
