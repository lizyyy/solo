from setuptools import setup, find_packages

setup(
    name='freight-audit',
    version='1.0.0',
    packages=find_packages(),
    install_requires=[
        'click>=8.1.0',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'freight-audit=freight_audit.cli:cli',
        ],
    },
)
