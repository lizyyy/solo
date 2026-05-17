from setuptools import setup, find_packages

setup(
    name="log-field-dict",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "click>=8.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "logdict=log_field_dict.cli:main",
        ],
    },
    author="Your Name",
    description="日志字段字典CLI - 分析日志字段冲突，生成统一字典报告",
    python_requires=">=3.7",
)
