from setuptools import setup, find_packages

setup(
    name="rabbitmq-topology-cli",
    version="0.1.0",
    description="RabbitMQ拓扑导出与分析CLI工具",
    author="Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0",
        "rich>=13.0",
        "jinja2>=3.0",
        "pydantic>=2.0",
    ],
    entry_points={
        "console_scripts": [
            "rabbitmq-topology=rabbitmq_topology.cli:main",
        ],
    },
    python_requires=">=3.8",
)
