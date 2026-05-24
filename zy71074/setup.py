from setuptools import setup, find_packages

setup(
    name="ros-drop-analyzer",
    version="1.0.0",
    description="ROS 传感器掉帧分析工具 - 分析 rosbag 中雷达、相机和 IMU 的帧丢失情况",
    author="ROS Team",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "rich>=13.0",
        "numpy>=1.21",
        "pandas>=1.3",
        "python-dateutil>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "ros-drop-analyzer=ros_drop_analyzer.cli:main",
        ],
    },
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Programming Language :: Python :: 3",
        "Topic :: Scientific/Engineering :: Robotics",
    ],
)
