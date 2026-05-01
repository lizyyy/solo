#!/usr/bin/env python
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="ticket-cluster-helper",
    version="1.0.0",
    author="Customer Service QA Team",
    author_email="qa-team@example.com",
    description="投诉工单相似簇助手 - 客服质检专用的本地AI/ML命令行工具",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/ticket-cluster-helper",
    packages=find_packages(include=["ticket_cluster_helper", "ticket_cluster_helper.*"]),
    include_package_data=True,
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Customer Service",
        "Intended Audience :: Information Technology",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Office/Business",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0.0",
        "numpy>=1.20.0",
        "scikit-learn>=1.0.0",
        "jieba>=0.42.1",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "isort>=5.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "ticket-cluster=ticket_cluster_helper.cli:main",
        ],
    },
    keywords=[
        "customer service",
        "ticket clustering",
        "text mining",
        "nlp",
        "quality assurance",
        "工单聚类",
        "客服质检",
        "文本分析",
    ],
    project_urls={
        "Bug Reports": "https://github.com/your-org/ticket-cluster-helper/issues",
        "Source": "https://github.com/your-org/ticket-cluster-helper",
    },
)
