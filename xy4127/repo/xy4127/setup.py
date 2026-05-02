from setuptools import setup, find_packages

setup(
    name="xy4127",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "python-dateutil>=2.8",
        "Pillow>=9.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "parcel=xy4127.main:cli",
        ],
    },
    python_requires=">=3.8",
)
