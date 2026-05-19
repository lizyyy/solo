from setuptools import setup, find_packages

setup(
    name='env-audit',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
        'tabulate>=0.8.0',
        'pydantic>=1.9.0',
    ],
    entry_points='''
        [console_scripts]
        env-audit=env_audit.cli:cli
    ''',
)
