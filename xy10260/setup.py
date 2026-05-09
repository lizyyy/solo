from setuptools import setup, find_packages

setup(
    name="avsec-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "avsec=avsec_cli.cli:cli",
        ],
    },
    python_requires=">=3.7",
)
