from setuptools import setup, find_packages

setup(
    name='agri-credit-cli',
    version='1.0.0',
    description='农资赊销回款管理 CLI 工具',
    packages=find_packages(),
    entry_points={
        'console_scripts': [
            'agri-credit=cli:main',
        ],
    },
    install_requires=[
        'click>=8.0.0',
    ],
    python_requires='>=3.7',
)
