from setuptools import setup, find_packages

setup(
    name="ferment_calibrator",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.3.0",
        "numpy>=1.20.0",
        "scipy>=1.7.0",
        "python-dateutil>=2.8.0",
        "jsonschema>=4.0.0",
    ],
    entry_points={
        "console_scripts": [
            "ferment-calibrator=ferment_calibrator.cli:main",
        ],
    },
    author="Fermentation Lab",
    description="发酵曲线校准器 - 小型发酵实验室的本地科学计算CLI工具",
    python_requires=">=3.8",
)
