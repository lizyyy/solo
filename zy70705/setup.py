from setuptools import setup, find_packages

setup(
    name="dep-upgrade-manager",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0",
        "pandas>=2.0",
        "openpyxl>=3.1",
        "packaging>=23.0",
        "pydantic>=2.0",
        "python-dateutil>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "dep-manage=dep_manage_cli.cli:main",
        ],
    },
    author="Dependency Management Team",
    description="多仓库依赖升级许可延期管理排查CLI",
    keywords="dependency, upgrade, license, management",
    python_requires=">=3.9",
)
