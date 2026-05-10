from setuptools import setup, find_packages

setup(
    name='vaccine-cold-chain',
    version='1.0.0',
    description='诊所疫苗冷链日志 CLI 工具',
    packages=find_packages(),
    install_requires=[
        'click==8.1.7',
        'python-dateutil==2.9.0.post0',
        'tabulate==0.9.0',
    ],
    entry_points={
        'console_scripts': [
            'cold-chain=vaccine_cold_chain.cli:main',
        ],
    },
    python_requires='>=3.8',
)
