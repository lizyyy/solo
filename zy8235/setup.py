#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

setup(
    name='antenna-scheduler',
    version='1.0.0',
    description='卫星地面站天线排程预检工具',
    author='Antenna Scheduler Team',
    packages=find_packages(),
    install_requires=[
        'pyyaml>=6.0',
        'click>=8.0',
        'pandas>=1.3',
        'python-dateutil>=2.8',
    ],
    entry_points={
        'console_scripts': [
            'antenna-scheduler = antenna_scheduler.cli:main',
        ],
    },
    python_requires='>=3.8',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Telecommunications Industry',
        'Topic :: Communications :: Satellite',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
)
