from setuptools import setup, find_packages

setup(
    name="i18n-placeholder-checker",
    version="1.0.0",
    description="翻译占位符一致性缺失定位排查CLI",
    author="Localization Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pyyaml>=6.0",
        "jinja2>=3.0.0",
    ],
    entry_points={
        "console_scripts": [
            "placeholder-checker = i18n_placeholder_checker.cli:main",
        ],
    },
    python_requires=">=3.8",
)
