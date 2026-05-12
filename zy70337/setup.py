from setuptools import setup, find_packages

setup(
    name='slo-calc',
    version='1.0.0',
    description='本地 SLO 计算 CLI 工具',
    packages=find_packages(),
    install_requires=[
        'click>=8.1.0',
        'pandas>=2.0.0',
        'numpy>=1.24.0',
        'pyyaml>=6.0',
        'rich>=13.0.0',
    ],
    entry_points={
        'console_scripts': [
            'slo-calc=slo_calc.cli:main',
        ],
    },
    python_requires='>=3.9',
)
