#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="asyncio-analyzer",
    version="0.1.0",
    description="A command-line tool for analyzing asyncio code for blocking, task leaks, and other issues",
    author="Your Team",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "click>=8.0",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "asyncio-analyzer=asyncio_analyzer.cli:main",
        ],
    },
    python_requires=">=3.10",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Debuggers",
    ],
)
