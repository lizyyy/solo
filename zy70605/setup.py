from setuptools import setup, find_packages

setup(
    name="out-of-stock-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "oos-cli=out_of_stock_cli.cli:main",
        ],
    },
    author="团长团队",
    description="缺货补偿库存回写结算一致性排查CLI",
    python_requires=">=3.9",
)
