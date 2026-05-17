from setuptools import setup, find_packages

setup(
    name="k8s-port-mapper",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "click>=8.0",
        "jinja2>=3.0",
        "tabulate>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "k8s-port-mapper=k8s_port_mapper.cli:main",
        ],
    },
    author="K8s Port Mapper",
    description="Kubernetes Service、Ingress 和 Pod 端口映射检查工具",
    keywords="kubernetes k8s port mapping ingress service",
    python_requires=">=3.8",
)
