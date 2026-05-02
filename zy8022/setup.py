from setuptools import setup, find_packages

setup(
    name="email-dns-checker",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0.0",
        "dnspython>=2.3.0",
    ],
    entry_points={
        "console_scripts": [
            "email-dns-checker = email_dns_checker.cli:main",
        ],
    },
    author="Email DNS Checker",
    description="Email delivery DNS health check CLI tool",
    long_description="A CLI tool for checking email delivery DNS health before launching new sending domains.",
    url="https://github.com/example/email-dns-checker",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)
