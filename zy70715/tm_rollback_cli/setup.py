from setuptools import setup, find_packages

setup(
    name="tm-rollback-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "tm-cli=tm_cli.main:cli",
        ],
    },
    author="Translation Memory Team",
    description="翻译记忆版本回滚一致性排查CLI工具",
    keywords="translation memory rollback consistency cli",
)
