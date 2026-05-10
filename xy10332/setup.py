from setuptools import setup, find_packages

setup(
    name='prescription-refill',
    version='1.0.0',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'refill=prescription_refill.cli:main',
        ],
    },
)
