#!/usr/bin/env python3
from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

with open('requirements.txt', 'r', encoding='utf-8') as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name='field-risk-calculator',
    version='1.0.0',
    author='Field Risk Calculator Team',
    description='野外踏勘风险计算员 - 地质野外路线风险评估工具',
    long_description=long_description,
    long_description_content_type='text/markdown',
    packages=find_packages(),
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Science/Research',
        'Topic :: Scientific/Engineering :: GIS',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.8',
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'field-risk-calc=field_risk_calculator.cli:cli',
        ],
    },
    include_package_data=True,
    package_data={
        'field_risk_calculator': ['examples/*'],
    },
    keywords='geology fieldwork risk assessment gpx dem terrain analysis',
)
