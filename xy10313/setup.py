from setuptools import setup, find_packages

setup(
    name="energy-share",
    version="1.0.0",
    description="物业公区能耗分摊 CLI 工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "sqlalchemy>=2.0.0",
        "openpyxl>=3.0.0",
        "python-dateutil>=2.8.0",
        "tabulate>=0.8.0",
    ],
    entry_points={
        "console_scripts": [
            "energy-share=energy_share.cli:cli",
        ],
    },
    python_requires=">=3.8",
)
