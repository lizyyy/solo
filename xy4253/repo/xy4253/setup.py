from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="eeg_aligner",
    version="0.1.0",
    author="EEG Aligner Team",
    description="脑电事件码对齐员 - 睡眠实验室事件码对齐和校验工具",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Bio-Informatics",
    ],
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.3.0",
        "numpy>=1.20.0",
        "rich>=12.0.0",
        "pydantic>=1.9.0",
        "scipy>=1.7.0",
    ],
    entry_points={
        "console_scripts": [
            "eeg-aligner=eeg_aligner.cli:main",
        ],
    },
)
