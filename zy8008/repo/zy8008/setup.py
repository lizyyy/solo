from setuptools import setup, find_packages

setup(
    name="crashlog-tool",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "crashlog-tool=crashlog_tool.cli:main",
        ],
    },
    author="Mobile Dev Team",
    description="A command-line tool for processing mobile crash logs",
    python_requires=">=3.8",
)
