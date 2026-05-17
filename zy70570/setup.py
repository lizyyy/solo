from setuptools import setup, find_packages

setup(
    name="perm-snapshot",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "pyyaml>=6.0",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "perm-snapshot=perm_snapshot.cli:main",
        ],
    },
    author="Permission Snapshot Team",
    description="Linux权限快照CLI工具 - 用于目录权限基线管理和差异对比",
    keywords="permission snapshot acl baseline audit",
    python_requires=">=3.8",
)
