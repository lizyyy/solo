from setuptools import setup, find_packages

setup(
    name="yaw-efficiency-checker",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "pyyaml>=6.0",
        "click>=8.0",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "yaw-checker = yaw_checker.main:main",
        ],
    },
    python_requires=">=3.9",
)