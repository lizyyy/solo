from setuptools import setup, find_packages

setup(
    name='agri-coop-billing',
    version='1.0.0',
    description='农机合作社作业计费 CLI 系统',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'sqlalchemy>=2.0.0',
        'pandas>=2.0.0',
        'openpyxl>=3.1.0',
        'tabulate>=0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'agri-billing=cli:main',
        ],
    },
    python_requires='>=3.8',
)
