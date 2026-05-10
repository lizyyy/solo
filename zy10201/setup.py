from setuptools import setup, find_packages

setup(
    name='book-consignment',
    version='1.0.0',
    description='二手书寄售结算 CLI 工具',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'tabulate>=0.9.0',
        'python-dateutil>=2.8.2',
    ],
    entry_points={
        'console_scripts': [
            'book-settle=book_consignment.cli:cli',
        ],
    },
    python_requires='>=3.7',
)
