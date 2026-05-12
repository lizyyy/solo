from setuptools import setup, find_packages

setup(
    name='csqc',
    version='1.0.0',
    description='客服敏感话术抽检 CLI',
    packages=find_packages(),
    include_package_data=True,
    package_data={
        'csqc.samples': ['*.json'],
    },
    install_requires=[
        'click>=8.0.0',
        'rich>=10.0.0',
    ],
    entry_points={
        'console_scripts': [
            'csqc=csqc.cli:cli',
        ],
    },
    python_requires='>=3.7',
)
