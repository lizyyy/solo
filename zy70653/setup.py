from setuptools import setup, find_packages

setup(
    name="quality-check-cli",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "openpyxl>=3.1.0",
        "python-dateutil>=2.8.0",
        "chardet>=5.0.0",
    ],
    entry_points={
        "console_scripts": [
            "qc-cli=quality_check.cli:main",
        ],
    },
    author="Quality Check Team",
    description="工单录音匹配缺失归因抽样清单排查CLI",
    python_requires=">=3.8",
)
