from setuptools import setup, find_packages

setup(
    name='archive-cli',
    version='0.1.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'sqlalchemy>=1.4.0',
        'pandas>=1.3.0',
        'pyyaml>=6.0',
        'tabulate>=0.8.0',
        'colorama>=0.4.4',
    ],
    entry_points={
        'console_scripts': [
            'archive-cli=archive_cli.cli:main',
        ],
    },
    python_requires='>=3.8',
)
