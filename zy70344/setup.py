from setuptools import setup, find_packages

setup(
    name="dr-cli",
    version="1.0.0",
    description="容灾切换演练 CLI 工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.1.0",
        "tabulate>=0.9.0",
        "PyYAML>=6.0",
        "colorama>=0.4.6",
    ],
    entry_points={
        "console_scripts": [
            "dr-cli=dr_cli.cli:cli",
        ],
    },
    python_requires=">=3.8",
)
