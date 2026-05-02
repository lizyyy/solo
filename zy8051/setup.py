from setuptools import setup, find_packages

setup(
    name="helm-drift-checker",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "PyYAML>=6.0",
    ],
    entry_points={
        "console_scripts": [
            "helm-drift-checker=helm_drift_checker.cli:main",
        ],
    },
    author="",
    description="A Helm upgrade drift pre-flight CLI for platform engineers",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
)
