from setuptools import setup, find_packages

setup(
    name="farm_scheduler",
    version="0.1.0",
    description="农机跨村调度 CLI 工具",
    packages=find_packages(),
    install_requires=["click>=8.0.0"],
    entry_points={
        "console_scripts": [
            "farm-scheduler = farm_scheduler.cli:main",
        ],
    },
    python_requires=">=3.8",
)
