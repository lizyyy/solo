from setuptools import setup, find_packages

setup(
    name="qr-material-cli",
    version="1.0.0",
    description="二维码物料领用 CLI 工具",
    packages=find_packages(),
    install_requires=[
        "click>=8.1.7",
        "pandas>=2.2.2",
        "openpyxl>=3.1.2",
    ],
    entry_points={
        "console_scripts": [
            "qr-material=qr_material_cli.__main__:main",
        ],
    },
    python_requires=">=3.8",
)
