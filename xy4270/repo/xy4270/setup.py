from setuptools import setup, find_packages

setup(
    name="prompt-router-stress-tester",
    version="1.0.0",
    description="提示词路由压测台 - 本地可运行的路由策略测试工具",
    author="Prompt Router Team",
    packages=find_packages(),
    install_requires=[
        "PyYAML>=6.0.1",
    ],
    entry_points={
        "console_scripts": [
            "prompt-router=prompt_router.cli.main:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
