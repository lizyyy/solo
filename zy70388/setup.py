from setuptools import setup, find_packages

setup(
    name='offset-fixer',
    version='1.0.0',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'python-dateutil>=2.8.0',
        'tabulate>=0.8.0',
    ],
    entry_points={
        'console_scripts': [
            'offset-fixer=offset_fixer.cli:main',
        ],
    },
    author='SRE Team',
    description='消息消费位点修复 CLI 工具',
    python_requires='>=3.7',
)
