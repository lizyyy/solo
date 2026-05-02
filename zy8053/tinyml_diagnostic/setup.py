from setuptools import setup, find_packages

setup(
    name='tinyml_diagnostic',
    version='0.1.0',
    packages=find_packages(),
    install_requires=['pyyaml>=6.0', 'click>=8.0'],
    entry_points={
        'console_scripts': [
            'tinyml-diagnostic=tinyml_diagnostic.cli:main',
        ],
    },
    python_requires='>=3.7',
)