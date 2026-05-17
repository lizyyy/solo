from setuptools import setup, find_packages

setup(
    name="docker-cache-audit",
    version="0.1.0",
    description="Dockerfile层缓存审计CLI工具 - 分析缓存失效原因并生成审计报告",
    author="DevOps Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=12.0.0",
        "pyyaml>=6.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "docker-cache-audit=docker_cache_audit.cli:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Build Tools",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
