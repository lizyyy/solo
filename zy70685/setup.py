from setuptools import setup, find_packages

setup(
    name='backup-cli',
    version='1.0.0',
    description='备机借用押金归还检查排查CLI工具',
    author='手机维修店管理系统',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
    ],
    entry_points={
        'console_scripts': [
            'backup-cli=backup_cli.cli:cli',
        ],
    },
    classifiers=[
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
    python_requires='>=3.8',
)
