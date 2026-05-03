#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(
    name="refchecker",
    version="0.1.0",
    description="参考文献一致性检查工具 - 用于学术论文写作的最后检查",
    author="RefChecker Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "bibtexparser>=1.4.0",
        "fuzzywuzzy>=0.18.0",
        "python-Levenshtein>=0.21.0",
    ],
    entry_points={
        "console_scripts": [
            "refchecker=refchecker.cli:main",
        ],
    },
    python_requires=">=3.7",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "Topic :: Text Processing :: Markup",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
