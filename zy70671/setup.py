from setuptools import setup, find_packages

setup(
    name='procurement-cli',
    version='1.0.0',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    install_requires=[
        'pandas>=2.0.0',
        'openpyxl>=3.1.0',
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'procurement=procurement_cli.cli:cli',
        ],
    },
    author='Procurement Team',
    description='采购比价税率折算缺项提示排查CLI工具',
    python_requires='>=3.8',
)
