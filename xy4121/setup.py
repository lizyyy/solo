from setuptools import setup, find_packages

setup(
    name="bend-checker",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'bend-checker = bend_checker.cli:cli',
        ],
    },
    author="Bend Checker Team",
    description="折弯展开复核器 - 钣金工艺展开计算与核查工具",
    keywords="bending, sheet metal, K factor, unfolding, sequence planning",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Manufacturing",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
