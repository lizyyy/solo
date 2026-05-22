from setuptools import setup, find_packages

setup(
    name='pharmacy-inspection',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'sqlalchemy>=2.0.0',
        'pandas>=2.0.0',
        'openpyxl>=3.1.0',
        'python-dateutil>=2.8.0',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'pharmacy-inspect=pharmacy_inspection.cli:cli',
        ],
    },
    author='Pharmacy Admin',
    description='乡镇药房近效期多源导入巡检 CLI 工具',
    keywords='pharmacy inspection cli',
)
