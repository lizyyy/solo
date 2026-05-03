"""
泳池水质投药复盘工具配置
"""
from setuptools import setup, find_packages

setup(
    name='pool-review',
    version='1.0.0',
    description='公共泳池水质投药复盘CLI工具',
    author='Pool Operations Team',
    packages=find_packages(),
    install_requires=[
        'pandas>=2.0.0',
        'pyyaml>=6.0',
        'python-dateutil>=2.8.0',
    ],
    entry_points={
        'console_scripts': [
            'pool-review=pool_review.cli:main',
        ],
    },
    python_requires='>=3.9',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
)
