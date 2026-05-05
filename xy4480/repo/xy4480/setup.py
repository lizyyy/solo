#!/usr/bin/env python
from setuptools import setup, find_packages

setup(
    name="dns-switch-sim",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.0",
        "rich>=13.0.0",
        "typer>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "dns-switch-sim=dns_switch_sim.cli:app",
        ],
    },
    author="Your Team",
    description="DNS 切换演练模拟工具 - 大促前 CDN 切换演练与检查",
    python_requires=">=3.9",
)
