from setuptools import setup, find_packages

setup(
    name="track-cleaner",
    version="0.1.0",
    packages=find_packages(include=["track_cleaner", "track_cleaner.*"]),
    install_requires=[
        "click>=8.0.0",
        "gpxpy>=1.5.0",
        "pandas>=2.0.0",
        "geopy>=2.3.0",
        "shapely>=2.0.0",
        "rich>=13.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "track-cleaner=track_cleaner.cli.main:main",
        ],
    },
    python_requires=">=3.8",
)
