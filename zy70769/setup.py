from setuptools import setup, find_packages

setup(
    name="proto-snapshot-checker",
    version="0.1.0",
    description="Proto字段编号兼容历史快照排查CLI",
    author="",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "protobuf>=4.0",
        "pyyaml>=6.0",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "proto-check=proto_snapshot_checker.cli:main",
        ],
    },
    python_requires=">=3.8",
)
