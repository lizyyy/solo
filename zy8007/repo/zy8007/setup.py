from setuptools import setup, find_packages

setup(
    name="qa_tool",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "jieba>=0.42.1",
        "scikit-learn>=1.0.0",
        "pandas>=1.3.0",
    ],
    entry_points={
        "console_scripts": [
            "qa_tool=qa_tool.cli:main",
        ],
    },
    author="Your Name",
    author_email="your.email@example.com",
    description="招投标问答资料整理工具",
    python_requires=">=3.8",
)
