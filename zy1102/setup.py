from setuptools import setup, find_packages

setup(
    name='hydroponic-cli',
    version='0.1.0',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'hydroponic=hydroponic_cli.cli:main',
        ],
    },
    author='Hydroponic Farmer',
    description='CLI tool for hydroponic nutrient solution management',
    python_requires='>=3.8',
)
