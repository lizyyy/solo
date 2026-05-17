from setuptools import setup, find_packages

setup(
    name="crontab-blackwindow",
    version="0.1.1",
    description="Crontab黑窗检查CLI工具",
    author="DevOps Team",
    packages=find_packages(),
    install_requires=[
        "croniter>=1.4.0",
        "python-dateutil>=2.8.2",
        "pytz>=2023.3",
    ],
    entry_points={
        "console_scripts": [
            "cbw=crontab_blackwindow.cli:main",
        ],
    },
    python_requires=">=3.8",
)
