#!/usr/bin/env python
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

setup(
    name='tracker-verifier',
    version='1.0.0',
    description='前端埋点日志回放检查工具',
    long_description='用于验证埋点日志是否符合预设规则的本地检查工具，支持JSONL和CSV格式日志，多种规则类型，以及HTML/Markdown/JSON报告输出。',
    author='Trae IDE',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'tracker-verifier=tracker_verifier.cli:main',
        ],
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Topic :: Software Development :: Testing',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
    python_requires='>=3.8',
    keywords='tracking, analytics, validation, logging, testing',
)
