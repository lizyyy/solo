from setuptools import setup, find_packages

setup(
    name="drill_service",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
    ],
    entry_points={
        "console_scripts": [
            "drill-service=drill_service.cli:main",
        ],
    },
)
