from setuptools import setup, find_packages

setup(
    name="freeze-gate",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=13.0.0",
        "pyyaml>=6.0",
        "pydantic>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "freeze-gate=freeze_gate.cli.main:cli",
        ],
    },
)
