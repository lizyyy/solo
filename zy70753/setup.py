from setuptools import setup, find_packages

setup(
    name="gha-matrix-shake",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "jinja2>=3.0",
        "python-dateutil>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "gha-shake=gha_matrix_shake.cli:main",
        ],
    },
    author="Your Team",
    description="GitHub Actions Matrix Shake Score Analysis Tool",
    python_requires=">=3.8",
)
