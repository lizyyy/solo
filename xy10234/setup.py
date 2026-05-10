from setuptools import setup, find_packages

setup(
    name='prop-deposit-cli',
    version='1.0.0',
    description='影棚道具借用押金管理 CLI',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'pandas>=1.5.0',
        'openpyxl>=3.0.0',
        'tabulate>=0.9.0'
    ],
    entry_points={
        'console_scripts': [
            'prop-deposit=cli:cli',
        ],
    },
    python_requires='>=3.8'
)
