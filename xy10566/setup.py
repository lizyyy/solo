from setuptools import setup, find_packages

setup(
    name="food_sample_ledger",
    version="1.0.0",
    description="学校食堂食品留样台账管理 CLI",
    author="Trae",
    packages=find_packages(),
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "food-sample=food_sample_ledger.cli:main",
        ],
    },
)
