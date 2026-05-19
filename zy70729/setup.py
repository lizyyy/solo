from setuptools import setup, find_packages

with open('requirements.txt') as f:
    requirements = f.read().splitlines()

setup(
    name='query-plan-checker',
    version='1.0.0',
    description='查询计划回归参数集合排查CLI工具',
    author='Query Plan Checker Team',
    packages=find_packages(),
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'qp-checker=query_plan_checker.cli:main',
        ],
    },
    python_requires='>=3.8',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
)
