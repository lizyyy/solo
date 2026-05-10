from setuptools import setup, find_packages

setup(
    name="waitlist-cli",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=12.0.0",
    ],
    entry_points={
        "console_scripts": [
            "waitlist=waitlist.cli:cli",
        ],
    },
    author="Trae",
    description="社区团课候补转正管理 CLI 工具",
    python_requires=">=3.8",
)
