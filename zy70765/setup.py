from setuptools import setup, find_packages

setup(
    name="har-analyzer-cli",
    version="1.0.0",
    description="HAR延迟分桶异常样本保留排查CLI",
    author="Dev Team",
    packages=find_packages(),
    install_requires=[
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "har-analyzer=har_analyzer.main:main",
        ],
    },
    python_requires=">=3.8",
)
