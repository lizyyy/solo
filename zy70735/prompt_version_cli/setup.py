from setuptools import setup, find_packages

setup(
    name="prompt-version-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "prompt-cli=prompt_cli.main:cli",
        ],
    },
    author="Prompt Version Team",
    description="模型提示版本实验流量命中摘要排查CLI",
    keywords="prompt version experiment traffic cli",
    python_requires=">=3.8",
)
