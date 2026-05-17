from setuptools import setup, find_packages

setup(
    name="api-archive",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "haralyzer>=2.0.0",
        "pyyaml>=6.0",
        "jinja2>=3.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "api-archive=api_archive.cli:cli",
        ],
    },
    author="API Archive Team",
    description="API抓包归档CLI工具 - 统一归档HTTP抓包数据",
    keywords="api har curl archive",
    python_requires=">=3.8",
)
