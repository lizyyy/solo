from setuptools import setup, find_packages

setup(
    name="fuel-recon",
    version="1.0.0",
    description="车队加油卡对账 CLI 工具",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "fuel-recon=fuel_recon.cli:main",
        ],
    },
    python_requires=">=3.8",
)
