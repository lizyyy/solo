from setuptools import setup, find_packages

setup(
    name="contract-log-sampler",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "contract-tool=contract_tool.cli:cli",
        ],
    },
)
