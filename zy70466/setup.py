from setuptools import setup, find_packages

setup(
    name="finance-carrier",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "pyyaml>=6.0",
        "jsonschema>=4.0.0",
    ],
    entry_points={
        "console_scripts": [
            "fcarrier=finance_carrier.cli:main",
        ],
    },
    author="Finance Team",
    description="财务结转表处理命令行工具",
    python_requires=">=3.8",
)
