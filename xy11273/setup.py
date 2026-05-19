from setuptools import setup, find_packages

setup(
    name="night-shift-ledger",
    version="0.1.0",
    description="仓库夜班班长台账管理CLI工具",
    packages=find_packages(include=["night_shift_ledger", "night_shift_ledger.*"]),
    install_requires=[
        "click>=8.0",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "ledger=night_shift_ledger.cli:cli",
        ],
    },
    python_requires=">=3.9",
)
