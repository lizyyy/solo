from setuptools import setup, find_packages

setup(
    name="art-valuation-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "click>=8.0.0",
        "pyyaml>=6.0.0",
        "openpyxl>=3.1.0",
    ],
    entry_points={
        "console_scripts": [
            "art-valuation=art_valuation.cli:main",
        ],
    },
    author="Art Storage Insurance",
    description="艺术品寄存库保险估值 CLI 工具",
    keywords="art valuation insurance storage",
    python_requires=">=3.8",
)
