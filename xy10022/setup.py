from setuptools import setup, find_packages

setup(
    name='event-manager',
    version='1.0.0',
    description='活动报名表管理系统 - 完整的状态流转、日志记录和历史版本管理',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'click>=8.0.0',
        'sqlalchemy>=2.0.0',
        'python-dotenv>=1.0.0',
        'tenacity>=8.0.0',
    ],
    entry_points={
        'console_scripts': [
            'eventmgr=event_manager.cli:cli',
        ],
    },
    python_requires='>=3.8',
)
