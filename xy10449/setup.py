from setuptools import setup, find_packages

setup(
    name='wechat-migration-cli',
    version='1.0.0',
    description='小程序用户迁移 CLI 工具',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.1.0',
        'tabulate>=0.9.0',
        'colorama>=0.4.6',
    ],
    entry_points={
        'console_scripts': [
            'wx-migrate=migration_cli.cli:main',
        ],
    },
    python_requires='>=3.8',
)
