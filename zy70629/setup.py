from setuptools import setup, find_packages

setup(
    name="loan-extension-cli",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "python-dateutil>=2.8.0",
        "pydantic>=2.0.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "loan-extension=loan_extension_cli.cli:main",
        ],
    },
    author="Finance Department",
    description="借款展期还款计划扣款流水排查CLI工具",
    python_requires=">=3.9",
)
