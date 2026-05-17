from setuptools import setup, find_packages

setup(
    name="inspection-cli",
    version="1.0.0",
    description="门店巡检整改复查管理命令行工具",
    author="Inspection Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "openpyxl>=3.0.0",
        "Pillow>=9.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "inspection-cli=inspection_cli.cli:cli",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)
