"""
巡检包断点补账员
地下管廊机器人巡检数据处理工具
"""

from setuptools import setup, find_packages

setup(
    name="inspection-package-fixer",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "pyyaml>=6.0",
        "pandas>=1.3.0",
        "click>=8.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "inspection-fixer=inspection_cli.cli:main",
        ],
    },
    python_requires=">=3.8",
)
