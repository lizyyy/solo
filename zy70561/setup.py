from setuptools import setup, find_packages

setup(
    name="docker-cache-audit",
    version="0.1.0",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "docker-cache-audit=docker_cache_audit.cli:main",
        ],
    },
)
