from setuptools import setup, find_packages

setup(
    name="visa-checker",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "python-dateutil>=2.8.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "visa-checker=visa_checker.cli:main",
        ],
    },
    author="Visa Checker Team",
    description="本地签证材料核对工具",
    python_requires=">=3.8",
)
