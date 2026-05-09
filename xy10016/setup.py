from setuptools import setup, find_packages

setup(
    name='inventory-cli',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.1.0',
        'sqlalchemy>=2.0.0',
        'pandas>=2.0.0',
        'openpyxl>=3.1.0',
        'tenacity>=8.2.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'inventory=inventory.cli:cli',
        ],
    },
    python_requires='>=3.9',
)
