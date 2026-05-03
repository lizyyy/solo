from setuptools import setup, find_packages

setup(
    name="pond_oxygen_calculator",
    version="1.0.0",
    description="鱼塘增氧调度计算器 - 水产实验室专用工具",
    author="水产实验室",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "pandas>=1.3.0",
        "scipy>=1.7.0",
        "matplotlib>=3.4.0",
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pond-calc=pond_oxygen_calculator.cli:cli",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Scientific/Engineering",
        "Topic :: Scientific/Engineering :: Information Analysis",
    ],
    python_requires=">=3.8",
)
