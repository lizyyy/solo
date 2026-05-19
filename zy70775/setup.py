#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="gitlfs-scout",
    version="0.1.0",
    description="Git LFS额度侦察排查CLI - 扫描Git历史中的LFS文件并分析额度使用情况",
    author="GitLFS Scout Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "pygit2>=1.10.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "gitlfs-scout = gitlfs_scout.cli:main",
        ],
    },
    python_requires=">=3.8",
)
