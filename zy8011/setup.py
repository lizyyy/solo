#!/usr/bin/env python3
from pathlib import Path
from setuptools import setup, find_packages

setup(
    name="inspection_organizer",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "Pillow>=9.0.0",
        "python-dateutil>=2.8.0",
    ],
    extras_require={
        "dev": [
            "piexif>=1.1.0",
            "pytest>=7.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "inspection-organizer=inspection_organizer.cli:main",
        ],
    },
    python_requires=">=3.8",
    description="连锁门店巡检照片整理工具",
    long_description=open('README.md', encoding='utf-8').read() if Path('README.md').exists() else '',
    long_description_content_type='text/markdown',
    author="Trae",
    url="https://github.com/yourusername/inspection-organizer",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Utilities",
    ],
)
