from setuptools import setup, find_packages

setup(
    name="kiln-curve-analyzer",
    version="1.0.0",
    description="窑温曲线复盘器 - 陶艺工作室窑炉数据复盘分析工具",
    author="Kiln Engineer",
    packages=find_packages(),
    install_requires=[
        "PyYAML>=6.0",
        "pandas>=2.0",
        "numpy>=1.24",
        "python-dateutil>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "kiln-analyzer=kiln_analyzer.cli:main",
        ],
    },
    python_requires=">=3.9",
)
