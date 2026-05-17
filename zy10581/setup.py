from setuptools import setup, find_packages

setup(
    name="deadletter-sampler",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "jinja2>=3.0",
        "rich>=12.0",
    ],
    entry_points={
        "console_scripts": [
            "deadletter-sampler=deadletter_sampler.cli:main",
        ],
    },
    author="Your Team",
    description="Dead letter queue message sampler CLI tool",
    python_requires=">=3.8",
)
