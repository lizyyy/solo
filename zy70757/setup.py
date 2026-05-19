from setuptools import setup, find_packages

setup(
    name="silence-audit",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "PyYAML>=6.0",
        "click>=8.0",
        "python-dateutil>=2.8",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "silence-audit=silence_audit.cli:main",
        ],
    },
)
