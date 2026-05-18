from setuptools import setup, find_packages

from visitor_timeout_cli import __version__

setup(
    name="visitor-timeout-cli",
    version=__version__,
    description="共享工位前台访客超时统计 CLI",
    author="Workspace Admin",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "visitor-timeout-cli=visitor_timeout_cli.cli:main",
        ],
    },
    python_requires=">=3.8",
)
