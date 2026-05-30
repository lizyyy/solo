from setuptools import setup, find_packages

setup(
    name="fee-penetrate",
    version="1.0.0",
    description="理财产品费用穿透 CLI - 管理费、托管费、销售服务费核对工具",
    author="Wealth Operations",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.1.0",
        "sqlalchemy>=2.0.0",
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "python-dateutil>=2.8.0",
        "rich>=13.0.0",
        "pydantic>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "fee=fee_penetrate.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.9",
)
