from setuptools import setup, find_packages

setup(
    name="review-cli",
    version="0.1.0",
    description="餐厅外卖差评复盘 CLI 工具",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0",
        "tabulate>=0.9.0",
        "python-dateutil>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "review-cli=review_cli.cli:main",
        ],
    },
    python_requires=">=3.8",
)
