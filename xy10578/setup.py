from setuptools import setup, find_packages

setup(
    name="lead-attribution",
    version="1.0.0",
    description="销售线索来源归因 CLI 工具",
    author="Trae",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=12.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "lead=lead_attribution.cli:cli",
        ],
    },
    package_data={
        "lead_attribution": ["data/*.json"],
    },
)
