from setuptools import setup, find_packages

setup(
    name="san-checker",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "cryptography>=41.0.0",
        "pyOpenSSL>=23.0.0",
        "jinja2>=3.1.0",
        "click>=8.0.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "san-checker=san_checker.cli:main",
        ],
    },
    author="Engineering Team",
    description="Certificate SAN Checker CLI",
    keywords="certificate san csr ssl tls",
    python_requires=">=3.8",
)
