from setuptools import setup, find_packages

setup(
    name='k8s-timeline',
    version='0.1.0',
    packages=find_packages(),
    entry_points={
        'console_scripts': [
            'k8s-timeline=k8s_timeline.cli:main',
        ],
    },
    install_requires=[
        'python-dateutil>=2.8.0',
        'pyyaml>=6.0',
        'tabulate>=0.9.0',
    ],
    python_requires='>=3.7',
    author='K8s DevOps Team',
    description='Kubernetes Deployment Timeline Analyzer CLI',
    keywords='kubernetes deployment timeline analyzer',
)
