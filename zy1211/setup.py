from setuptools import setup, find_packages

setup(
    name="perf-debugger",
    version="0.1.0",
    description="Linux Performance Troubleshooting Assistant CLI",
    author="Performance Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0",
        "rich>=12.0",
        "sqlalchemy>=1.4",
        "pandas>=1.3",
    ],
    entry_points={
        "console_scripts": [
            "perf-debugger=perf_debugger.cli:main",
        ],
    },
    python_requires=">=3.8",
)