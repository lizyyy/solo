from setuptools import setup, find_packages

setup(
    name='metro-power-analyzer',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'PyYAML>=6.0',
        'jinja2>=3.0',
    ],
    entry_points={
        'console_scripts': [
            'metro-power-analyzer=metro_power_analyzer.cli:main',
        ],
    },
    author='Metro Power Maintenance Team',
    description='Metro traction substation protection event analysis tool',
    python_requires='>=3.8',
)
