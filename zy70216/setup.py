from setuptools import setup, find_packages

setup(
    name="marathon-supply-predictor",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "msp=marathon_supply_predictor.cli:main",
        ],
    },
    author="Marathon Supply Team",
    description="马拉松补给消耗预测器",
    python_requires=">=3.8",
)
