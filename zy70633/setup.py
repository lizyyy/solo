from setuptools import setup, find_packages

setup(
    name="equipment-rental-cli",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "pandas>=1.5.0",
        "python-dateutil>=2.8.0",
        "openpyxl>=3.0.0",
        "xlsxwriter>=3.0.0",
    ],
    entry_points="""
        [console_scripts]
        equipment-cli=equipment_rental_cli.main:cli
    """,
    author="Studio Equipment Management",
    description="器材配件归还复核押金扣款排查CLI",
)
