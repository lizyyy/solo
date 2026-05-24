from setuptools import setup, find_packages

setup(
    name="prom-cardinality",
    version="0.1.0",
    description="Prometheus 基数估算 CLI 工具 - 分析高风险 label 组合",
    author="Cardinality Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "tabulate>=0.9.0",
        "PyYAML>=6.0",
    ],
    entry_points={
        "console_scripts": [
            "prom-cardinality=prom_cardinality.cli:main",
        ],
    },
    python_requires=">=3.8",
)
