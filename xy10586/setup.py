from setuptools import setup, find_packages

setup(
    name="refund-interceptor",
    version="1.0.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=10.0.0",
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "refund-interceptor=refund_interceptor.cli:main",
        ],
    },
    author="Refund Interceptor Team",
    description="财务批量退款异常拦截 CLI 工具",
    python_requires=">=3.8",
)
