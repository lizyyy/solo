from setuptools import setup, find_packages

setup(
    name="font-auditor",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "python-pptx>=0.6.21",
        "pdfplumber>=0.7.0",
        "lxml>=4.9.0",
        "tinycss2>=1.2.0",
        "pydantic>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "font-auditor=font_auditor.cli:main",
        ],
    },
    python_requires=">=3.9",
)
