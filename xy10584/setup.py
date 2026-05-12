from setuptools import setup, find_packages

setup(
    name='research-insurance-cli',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.1.0',
        'colorama>=0.4.6',
    ],
    entry_points={
        'console_scripts': [
            'ri=research_insurance.cli:main',
        ],
    },
)
