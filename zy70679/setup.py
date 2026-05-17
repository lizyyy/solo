from setuptools import setup, find_packages

setup(
    name="invoice-splitter",
    version="1.0.0",
    description="酒旅发票项目拆分税额校正排查CLI",
    author="Invoice Splitter Team",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "invoice-splitter=invoice_splitter.cli:main",
        ],
    },
    python_requires=">=3.7",
)
