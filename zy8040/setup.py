from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="rt_quality",
    version="0.1.0",
    author="",
    description="心理学反应时实验数据质检与统计报告工具",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    python_requires=">=3.7",
    install_requires=[
        "pandas>=1.3.0",
        "pyyaml>=5.4.0",
        "matplotlib>=3.4.0",
        "seaborn>=0.11.0",
    ],
    include_package_data=True,
    package_data={
        "rt_quality": ["examples/*.csv", "examples/*.yaml"],
    },
)
