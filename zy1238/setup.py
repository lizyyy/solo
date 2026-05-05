"""Setup file for concurrency-checker"""

from setuptools import setup, find_packages

setup(
    name="concurrency-checker",
    version="0.1.0",
    description="Python 并发方案体检 CLI 工具",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.9",
    install_requires=[
        "pyyaml>=6.0",
        "rich>=13.0",
        "click>=8.0",
        "aiofiles>=23.0",
    ],
    entry_points={
        "console_scripts": [
            "concurrency-checker=concurrency_checker.cli:main",
        ],
    },
)