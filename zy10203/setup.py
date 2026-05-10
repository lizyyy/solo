from setuptools import setup, find_packages

setup(
    name="warehouse-return-inspector",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "openpyxl>=3.0.0",
        "pandas>=1.3.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "wh-return=warehouse_return_inspector.cli:main",
        ],
    },
)
