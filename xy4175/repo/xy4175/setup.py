from setuptools import setup, find_packages

setup(
    name="bearing_vibration_detector",
    version="1.0.0",
    description="轨道交通轴承振动早筛员 - 本地AI/ML异常检测工具",
    author="Bearing Vibration Detector Team",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "pandas>=1.3.0",
        "scipy>=1.7.0",
        "scikit-learn>=1.0.0",
        "matplotlib>=3.4.0",
        "python-dateutil>=2.8.0",
    ],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "bearing-detector=main:main",
        ],
    },
)
