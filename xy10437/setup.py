from setuptools import setup, find_packages

setup(
    name='vaccine-waitlist',
    version='1.0.0',
    description='社区疫苗预约候补管理系统 CLI',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'vaccine-waitlist=vaccine_waitlist.cli:cli',
        ],
    },
    python_requires='>=3.7',
)
