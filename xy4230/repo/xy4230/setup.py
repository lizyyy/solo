from setuptools import setup, find_packages

setup(
    name="qc-grader",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "click>=8.0.0",
        "pyyaml>=6.0",
    ],
    entry_points={
        "console_scripts": [
            "qc-grader = qc_grader.cli:main",
        ],
    },
)
