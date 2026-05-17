from setuptools import setup, find_packages

setup(
    name="image-tag-linter",
    version="0.1.0",
    description="Docker镜像标签命名规范检查CLI工具",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0",
        "pydantic>=2.0",
        "rich>=13.0",
        "jinja2>=3.0",
    ],
    entry_points={
        "console_scripts": [
            "image-tag-linter=image_tag_linter.cli:main",
        ],
    },
)
