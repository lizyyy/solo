from setuptools import setup, find_packages

setup(
    name="evidence-timeline-checker",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click==8.1.7",
        "pyyaml==6.0.1",
        "python-dateutil==2.8.2",
    ],
    entry_points={
        "console_scripts": [
            "evidence-checker=evidence_timeline.cli:main",
        ],
    },
    author="庭审证据时间线核对器",
    description="一个用于诉讼助理的本地命令行工具，用于核对庭审证据时间线",
    python_requires=">=3.7",
)
