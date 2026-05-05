from setuptools import setup, find_packages

setup(
    name="stage-supervisor",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "rich>=12.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "stage-supervisor=stage_supervisor.main:main",
        ],
    },
    author="Stage Supervisor Team",
    description="小剧场舞台监督自动化工具",
    python_requires=">=3.8",
)
