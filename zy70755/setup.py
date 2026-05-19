from setuptools import setup, find_packages

setup(
    name="openapi-fuzz-checker",
    version="0.1.0",
    description="OpenAPI示例扰动兼容校验排查CLI",
    author="Your Name",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "jsonschema>=4.0.0",
        "prance>=0.21.0",
        "rich>=12.0.0",
        "pydantic>=1.10.0",
    ],
    entry_points={
        "console_scripts": [
            "openapi-fuzz=openapi_fuzz_checker.cli.main:cli",
        ],
    },
    python_requires=">=3.8",
)
