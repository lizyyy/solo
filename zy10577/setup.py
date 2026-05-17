from setuptools import setup, find_packages

setup(
    name="dep-break-scanner",
    version="0.1.0",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    python_requires=">=3.9",
    install_requires=[
        "click>=8.0",
        "pyyaml>=6.0",
        "rich>=13.0",
        "aiohttp>=3.8",
        "pathspec>=0.11.0",
    ],
    entry_points={
        "console_scripts": [
            "dep-break = dep_break_scanner.cli:main",
        ],
    },
)
