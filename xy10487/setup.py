from setuptools import setup, find_packages

setup(
    name="quality_sampling",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.1.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "qc-sampling=quality_sampling.cli:cli",
        ],
    },
)
