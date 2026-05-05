#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="memprofiler",
    version="0.1.0",
    author="Memory Profiler Team",
    author_email="memprofiler@example.com",
    description="Python内存问题排查小工具 - 用于培训目的",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/example/memprofiler",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Education",
        "Topic :: Software Development :: Debuggers",
        "Topic :: Education :: Training",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
    install_requires=[
        "click>=8.0",
        "tabulate>=0.9.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "memprofiler=memprofiler.cli:main",
        ],
    },
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-cov>=4.0",
        ],
    },
    include_package_data=True,
    package_data={
        "memprofiler": ["py.typed"],
    },
)
