from setuptools import setup, find_packages

setup(
    name="dnszone-diff",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "dnszone-diff=dnszone_diff.cli:main",
        ],
    },
    author="DNS Zone Diff Tool",
    description="DNS Zone Environment Difference Check CLI",
    python_requires=">=3.8",
)
