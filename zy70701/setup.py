from setuptools import setup, find_packages

setup(
    name="contract-drift-cli",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.1.7",
        "pydantic>=2.6.1",
        "pyyaml>=6.0.1",
        "jinja2>=3.1.3",
        "rich>=13.7.0",
    ],
    entry_points={
        "console_scripts": [
            "contract-drift=contract_drift.cli:main",
        ],
    },
    author="Your Name",
    description="契约样例消费方确认的漂移闭环排查CLI",
    keywords="api, contract, drift, detection",
    python_requires=">=3.10",
)
