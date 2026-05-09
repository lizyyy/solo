from setuptools import setup, find_packages

setup(
    name="task_compensation",
    version="1.0.0",
    description="定时任务漏跑补偿系统",
    author="Task Compensation Team",
    packages=find_packages(),
    install_requires=[
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.0",
    ],
    python_requires=">=3.8",
)
