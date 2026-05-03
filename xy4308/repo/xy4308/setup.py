#!/usr/bin/env python
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

with open("requirements.txt", "r", encoding="utf-8") as f:
    requirements = f.read().splitlines()

setup(
    name="freeze-dryer-reviewer",
    version="0.1.0",
    author="Freeze Dryer Team",
    author_email="info@example.com",
    description="冻干曲线复盘器 - 生物制剂工艺科学计算CLI工具",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/example/freeze-dryer-reviewer",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Bio-Informatics",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "fd-reviewer=freeze_dryer_reviewer.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "freeze_dryer_reviewer": ["examples/*"],
    },
)
