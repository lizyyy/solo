from setuptools import setup, find_packages

setup(
    name="crm-migrate-check",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "crm-migrate-check = crm_migrate.cli:main",
        ],
    },
    python_requires=">=3.8",
    author="CRM Migration Team",
    description="A CLI tool for pre-migration data validation and SQL generation",
)
