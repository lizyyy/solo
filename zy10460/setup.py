from setuptools import setup, find_packages

setup(
    name="wheel-validator",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "packaging>=21.0",
        "importlib_metadata>=4.0; python_version < '3.8'",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "wheel-validator=wheel_validator.cli:main",
        ],
    },
    python_requires=">=3.7",
    author="Wheel Validator Team",
    description="A comprehensive CLI tool for validating Python wheel metadata",
    keywords="wheel, packaging, validation, metadata",
)
