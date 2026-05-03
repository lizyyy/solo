from setuptools import setup, find_packages

setup(
    name="feeder-protection-coordination",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "pandas>=1.5.0",
        "matplotlib>=3.5.0",
        "networkx>=2.8.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "feeder-coord=main:main",
        ],
    },
    author="Feeder Protection Team",
    description="配网馈线保护配合复核工具",
    python_requires=">=3.8",
)
