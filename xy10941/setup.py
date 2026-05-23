from setuptools import setup, find_packages

setup(
    name="store-reconcile-cli",
    version="1.0.0",
    description="门店收银差异对账CLI工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.4.0",
        "python-dateutil>=2.8.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "store-reconcile=store_reconcile.cli:main",
        ],
    },
    python_requires=">=3.8",
)
