from setuptools import setup, find_packages

setup(
    name="offline-sync-repair",
    version="1.0.0",
    description="离线地块包同步修补员 - 农机服务站运维工具",
    author="",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "geojson>=3.0.0",
        "mercantile>=1.2.0",
        "python-dateutil>=2.8.0",
        "rich>=12.0.0",
        "pytest>=7.0.0",
    ],
    entry_points={
        "console_scripts": [
            "offline-sync-repair=offline_sync_repair.cli:cli",
        ],
    },
    python_requires=">=3.8",
)
