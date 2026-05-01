from setuptools import setup, find_packages

setup(
    name="dc-change-preview",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pyyaml>=6.0",
        "click>=8.0",
    ],
    entry_points={
        "console_scripts": [
            "dc-preview=dc_change_preview.cli:main",
        ],
    },
    python_requires=">=3.9",
)
