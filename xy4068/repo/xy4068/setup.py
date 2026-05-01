from setuptools import setup, find_packages

setup(
    name="event_simulator",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "pydantic>=2.0.0",
        "pyyaml>=6.0",
        "rich>=13.0.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "event-simulator=event_simulator.cli.main:cli",
        ],
    },
    author="Edge AI Team",
    description="边缘 AI 摄像头算法验收事件流仿真器",
    python_requires=">=3.9",
)
