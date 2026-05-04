from setuptools import setup, find_packages

setup(
    name="jvm-tune-cli",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.3.0",
        "numpy>=1.20.0",
        "pyyaml>=5.4.0",
        "matplotlib>=3.4.0",
    ],
    entry_points={
        "console_scripts": [
            "jvm-tune=jvm_tune_cli.cli:main",
        ],
    },
    author="Your Team",
    description="JVM Tuning CLI for Containerized Applications",
    python_requires=">=3.8",
)
