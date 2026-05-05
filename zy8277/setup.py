#!/usr/bin/env python
# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

setup(
    name="bill-calc",
    version="1.0.0",
    author="Billing Team",
    author_email="billing@example.com",
    description="A local command-line billing trial calculation tool",
    long_description="A tool for门店 or SaaS billing teams to replay sample orders before going live with new rules. Reads bills.yaml, discounts.csv, tax-rules.json, and rounding-profiles.json. Supports init, calc, compare, export commands. Core capabilities include pre-tax/post-tax discounts, service fees, tax-exempt items, line-level and order-level rounding, and handling penny differences caused by ROUND_HALF_UP, CEIL, FLOOR strategies. Provides readable errors for missing fields, discounts exceeding subtotal, and conflicting tax configurations.",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "pyyaml>=6.0",
        "click>=8.0",
        "pandas>=1.5.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "bill-calc=bill_calc.cli:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Financial and Insurance Industry",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Office/Business :: Financial",
        "Topic :: Software Development :: Testing",
    ],
)
