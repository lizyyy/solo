from setuptools import setup, find_packages

setup(
    name="offline-gate-reconciler",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "gate-reconciler=offline_gate_reconciler.cli:main",
        ],
    },
    python_requires=">=3.9",
    author="Offline Gate Team",
    description="线下展会离线闸口对账工具",
)
