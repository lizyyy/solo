from setuptools import setup, find_packages

setup(
    name="toml-validator",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "tomlkit>=0.12",
        "pydantic>=2.0",
        "jinja2>=3.0",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "toml-validator=toml_validator.cli:main",
        ],
    },
    python_requires=">=3.9",
)
