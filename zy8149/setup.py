from setuptools import setup, find_packages

setup(
    name="flight_precheck",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "geojson>=3.0.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "flight-precheck=flight_precheck.cli:main",
        ],
    },
    author="Power Inspection Team",
    description="Offline route compliance pre-check CLI for power inspection teams",
    python_requires=">=3.8",
)
