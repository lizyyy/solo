#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

setup(
    name="web-evidence-organizer",
    version="0.1.0",
    description="网页证据包整理员 - 为法务助理和售后仲裁小组设计的证据整理工具",
    author="Web Evidence Organizer Team",
    packages=find_packages(exclude=["tests", "samples"]),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "beautifulsoup4>=4.9.0",
        "lxml>=4.9.0",
        "python-dateutil>=2.8.0",
        "pytz>=2023.3",
        "Pillow>=10.0.0",
        "python-magic>=0.4.27",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "evidence=web_evidence_organizer.cli:cli",
        ],
    },
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Legal Industry",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
