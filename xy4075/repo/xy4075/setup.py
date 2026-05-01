from setuptools import setup, find_packages

setup(
    name="serial-protocol-diagnostic",
    version="1.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "pydantic>=2.0.0",
        "rich>=13.0.0",
        "pandas>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "serial-diag=serial_diagnostic.cli:main",
        ],
    },
    author="Embedded Test Team",
    description="串口协议回放诊断台 - 嵌入式测试工具",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Testing",
        "Topic :: System :: Hardware",
    ],
    python_requires=">=3.9",
)
