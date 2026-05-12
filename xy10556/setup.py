from setuptools import setup, find_packages

setup(
    name='gift-fulfillment',
    version='1.0.0',
    description='电商赠品履约CLI工具',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'colorama>=0.4.6',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'gift=src.cli:cli',
        ],
    },
    python_requires='>=3.8',
)
