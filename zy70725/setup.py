from setuptools import setup, find_packages

setup(
    name="data-contract-cli",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0",
        "pydantic>=2.0",
        "python-dateutil>=2.8",
        "pandas>=2.0",
        "openpyxl>=3.1",
    ],
    entry_points={
        "console_scripts": [
            "data-contract-cli = data_contract_cli.main:cli",
        ],
    },
    author="Your Team",
    description="数据契约例外到期恢复排查CLI",
    python_requires=">=3.9",
)
