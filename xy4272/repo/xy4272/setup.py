from setuptools import setup, find_packages

setup(
    name="reading_recommender",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "pyyaml>=6.0",
        "rich>=12.0.0",
    ],
    entry_points={
        "console_scripts": [
            "reading_recommender=reading_recommender.cli:main",
        ],
    },
    python_requires=">=3.8",
    author="Library Tech Team",
    description="阅读包推荐质检员 - 县图书馆少儿阅读活动推荐系统",
    keywords="library, reading, recommendation, children",
)
