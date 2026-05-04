from setuptools import setup, find_packages

setup(
    name="signup-handler",
    version="0.1.0",
    description="微信群接龙报名自动化处理工具",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="",
    packages=find_packages("src"),
    package_dir={"": "src"},
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "jinja2>=3.0.0",
        "python-dateutil>=2.8.0",
        "phonenumbers>=8.12.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "signup=signup_handler.cli:main",
        ],
    },
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Utilities",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
