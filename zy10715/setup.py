from setuptools import setup, find_packages

setup(
    name="warehouse-freeze-snapshot-validator",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "仓库冻结快照库存释放校验=warehouse_validator.cli:main",
            "warehouse-validator=warehouse_validator.cli:main",
        ],
    },
    author="Warehouse Team",
    description="仓库冻结快照库存释放校验 CLI 工具",
    python_requires=">=3.8",
)
