from setuptools import setup, find_packages

setup(
    name="firmware-delivery",
    version="1.0.0",
    description="固件校准包投递员 - 现场设备维护工程师的本地命令行工具",
    author="Field Maintenance Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.0",
        "cryptography>=41.0.0",
    ],
    entry_points={
        "console_scripts": [
            "firmware-delivery=firmware_delivery.cli:cli",
        ],
    },
    python_requires=">=3.9",
)
