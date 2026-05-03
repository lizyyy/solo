#!/usr/bin/env python
from setuptools import setup, find_packages

setup(
    name="dmx-protect",
    version="0.1.0",
    author="Theater Stage Manager",
    author_email="stage@theater.local",
    description="DMX 演出线索核对工具 - 换景灯光防撞器",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/theater/dmx-protect",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Multimedia :: Sound/Audio",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[],
    extras_require={
        "test": ["pytest>=6.0", "pytest-cov"],
    },
    entry_points={
        "console_scripts": [
            "dmx-protect=dmx_protect.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "dmx_protect": ["examples/*"],
    },
)
