from setuptools import setup, find_packages

setup(
    name='request-regression',
    version='0.1.0',
    packages=find_packages(),
    install_requires=[
        'click>=8.0.0',
        'requests>=2.25.0',
        'PyYAML>=6.0',
        'deepdiff>=5.8.0',
        'colorama>=0.4.0',
    ],
    entry_points={
        'console_scripts': [
            'rr=request_regression.cli:cli',
        ],
    },
    author='Order Service Team',
    description='请求录制回归测试 CLI 工具',
    python_requires='>=3.8',
)
