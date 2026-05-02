from setuptools import setup, find_packages

setup(
    name="dmx-patch-validator",
    version="1.0.0",
    description="DMX地址补丁校验员 - 小剧场灯光师必备工具",
    author="DMX Tool Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click>=8.0.0",
        "rich>=12.0.0",
        "pydantic>=2.0.0",
    ],
    entry_points={
        "console_scripts": [
            "dmx-validator=dmx_patch_validator.cli:main",
        ],
    },
    python_requires=">=3.8",
)
