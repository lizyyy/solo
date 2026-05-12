from setuptools import setup, find_packages

setup(
    name="kbcheck",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "beautifulsoup4>=4.9.0",
        "markdown>=3.3.0",
        "python-dateutil>=2.8.0",
        "rich>=10.0.0",
    ],
    entry_points={
        "console_scripts": [
            "kbcheck=kbcheck.cli:cli",
        ],
    },
    python_requires=">=3.7",
)
