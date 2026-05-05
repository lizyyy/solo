from setuptools import setup, find_packages

setup(
    name='archive-cli',
    version='0.1.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'pandas>=1.3.0',
        'rich>=10.0.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points='''
        [console_scripts]
        archive=archive_cli.cli:cli
    ''',
    author='Archive CLI Team',
    description='A local command-line tool for small archives to manage microfilm借阅流程',
    python_requires='>=3.7',
)
