from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="nginx-route-checker",
    version="1.0.0",
    author="Nginx Route Checker Team",
    description="Nginx 路由冲突检测工具 - 检测 location 规则冲突和路径覆盖问题",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/nginx-route-checker",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: System Administrators",
        "Intended Audience :: Developers",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: System :: Systems Administration",
        "Topic :: Utilities",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "nginx-route-checker=nginx_route_checker.cli:main",
        ],
    },
    keywords="nginx route location conflict detect check",
)
