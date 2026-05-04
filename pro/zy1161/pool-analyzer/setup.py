from setuptools import setup, find_packages

setup(
    name="pool-analyzer",
    version="1.0.0",
    author="Pool Analyzer Team",
    description="数据库连接池分析工具 - 分析多服务共用PostgreSQL的连接风险",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "pandas>=1.3.0",
        "rich>=12.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pool-analyze=pool_analyzer.cli:cli",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
