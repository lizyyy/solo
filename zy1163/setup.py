from setuptools import setup

setup(
    name="asyncio-diagnose",
    version="0.1.0",
    packages=["asyncio_diagnose"],
    install_requires=[
        "click>=8.0",
        "pyyaml>=6.0",
        "rich>=12.0",
    ],
    extras_require={
        "test": [
            "pytest>=7.0",
            "pytest-cov>=4.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "asyncio-diagnose=asyncio_diagnose.cli:main",
        ],
    },
)
