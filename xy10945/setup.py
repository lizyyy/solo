from setuptools import setup, find_packages

setup(
    name="property-meter-cli",
    version="0.1.0",
    description="物业水电抄表数据处理 CLI 工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "meter-cli=property_meter.cli:main",
        ],
    },
    python_requires=">=3.9",
)
