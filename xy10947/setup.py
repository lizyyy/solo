from setuptools import setup, find_packages

setup(
    name="food-waste-cli",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "pandas>=2.0.0",
        "openpyxl>=3.1.0",
        "click>=8.0.0",
        "rich>=13.0.0",
        "pydantic>=2.0.0",
        "jinja2>=3.1.0",
    ],
    entry_points={
        "console_scripts": [
            "food-waste=food_waste.cli:main",
        ],
    },
    author="餐饮损耗分析工具",
    description="餐饮原料损耗分析CLI工具",
    python_requires=">=3.9",
)
