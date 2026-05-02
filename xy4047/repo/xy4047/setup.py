from setuptools import setup, find_packages

setup(
    name="rov-tension-checker",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "rov-tension=rov_tension_checker.cli.main:cli",
        ],
    },
    author="ROV Inspection Team",
    description="ROV 放缆张力校核器 - 海工检测队专用科学计算工具",
    keywords="rov, tension, catenary, offshore, inspection",
    python_requires=">=3.9",
)