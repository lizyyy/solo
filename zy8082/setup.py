from setuptools import setup, find_packages

setup(
    name="elevator_qc",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "pyyaml>=6.0",
        "plotly>=5.14.0",
    ],
    entry_points={
        "console_scripts": [
            "elevator-qc=elevator_qc.cli:main",
        ],
    },
    author="",
    description="Elevator maintenance quality control tool",
    python_requires=">=3.9",
)
