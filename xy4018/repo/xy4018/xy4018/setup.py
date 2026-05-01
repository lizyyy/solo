"""
合同改稿巡检器 - 安装配置
"""

from setuptools import setup, find_packages

setup(
    name="contract-inspector",
    version="0.1.0",
    description="合同改稿巡检器 - 小法务团队的本地命令行工具，用于对比合同版本变化和风险规则扫描",
    author="Contract Inspector Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "python-dateutil>=2.8.0",
        "deepdiff>=6.0.0",
        "flask>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "contract-inspector=contract_inspector.cli:cli",
            "contract-inspector-web=contract_inspector.web:run_server",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)
