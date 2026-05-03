from setuptools import setup, find_packages

setup(
    name="bus_replay_diagnostic",
    version="1.0.0",
    description="总线回放诊断台 - 无人车CAN总线日志分析工具",
    author="无人车社团",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "rich>=12.0.0",
        "numpy>=1.21.0",
        "pandas>=1.3.0",
    ],
    entry_points={
        "console_scripts": [
            "bus-diagnostic=bus_replay_diagnostic.cli.main:cli",
        ],
    },
    python_requires=">=3.8",
)
