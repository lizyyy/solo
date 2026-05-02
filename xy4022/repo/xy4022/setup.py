from setuptools import setup, find_packages

setup(
    name="资料包交付巡检器",
    version="0.1.0",
    author="公司内训团队",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "click>=8.0.0",
        "python-dotenv>=0.19.0",
        "rich>=10.0.0",
    ],
    entry_points={
        "console_scripts": [
            "checker=checker.cli.main:cli",
        ],
    },
    python_requires=">=3.8",
    description="用于检查资料包完整性和一致性的命令行工具",
)
