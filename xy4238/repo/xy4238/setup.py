from setuptools import setup, find_packages

setup(
    name="evidence-anchor-checker",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=13.0.0",
    ],
    entry_points={
        "console_scripts": [
            "evidence-anchor=evidence_anchor_checker.cli:main",
        ],
    },
    author="Court Clerk Assistant",
    description="庭审笔录证据锚点核对员 - 本地命令行工具",
    python_requires=">=3.8",
)
