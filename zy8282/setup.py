"""安装配置"""

from setuptools import setup, find_packages

setup(
    name="report-audit",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "PyYAML>=6.0",
        "click>=8.0",
        "fastapi>=0.100.0",
        "uvicorn>=0.23.0",
        "python-multipart>=0.0.6",
    ],
    entry_points={
        "console_scripts": [
            "report-audit=audit_tool.cli:cli",
        ],
    },
    author="Your Team",
    description="本地经营周报一致性复核工具",
    keywords="audit, report, consistency, coffee, chain",
    python_requires=">=3.8",
)
