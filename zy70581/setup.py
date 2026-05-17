from setuptools import setup, find_packages

with open('requirements.txt', encoding='utf-8') as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name='header-mapper',
    version='0.1.0',
    description='电子表头映射CLI - 自动匹配Excel表头到标准字段',
    author='Your Name',
    packages=find_packages(),
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'header-mapper=header_mapper.cli.main:main',
        ],
    },
    python_requires='>=3.8',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
)
