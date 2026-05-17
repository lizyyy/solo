from setuptools import setup, find_packages

setup(
    name="envoy-route-simulator",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "jinja2>=3.0",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "envoy-route-sim=envoy_route_simulator.cli:main",
        ],
    },
    author="Engineering Team",
    description="Envoy路由模拟工具 - 上线前验证路由规则",
    python_requires=">=3.8",
)
