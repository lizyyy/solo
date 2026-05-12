from setuptools import setup, find_packages

setup(
    name="salary_checker",
    version="1.0.0",
    description="发薪异常解释 CLI 工具",
    author="Salary Checker Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "tabulate>=0.9.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "salary=salary_checker.cli:cli",
        ],
    },
    python_requires=">=3.8",
)
