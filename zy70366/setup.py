from setuptools import setup, find_packages

setup(
    name="change-correlate",
    version="0.1.0",
    description="变更单关联告警 CLI - 故障复盘时的证据链分析工具",
    author="Trae AI",
    packages=find_packages(),
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "change-correlate=change_correlator.cli:main",
        ],
    },
)
