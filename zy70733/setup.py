from setuptools import setup, find_packages

setup(
    name="api-change-cli",
    version="1.0.0",
    description="接口变更订阅确认超时排查CLI",
    author="API Governance Team",
    packages=find_packages(),
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "api-change-cli=api_change_cli.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
