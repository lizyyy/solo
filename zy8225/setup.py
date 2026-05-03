from setuptools import setup, find_packages

setup(
    name="pump-review",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pandas>=1.5.0",
        "numpy>=1.21.0",
        "pyyaml>=6.0",
        "scikit-learn>=1.0.0",
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pump-review=pump_review.cli:main",
        ],
    },
    author="Reliability Engineering Team",
    description="工业泵振动模型告警复核工具",
    python_requires=">=3.8",
)
