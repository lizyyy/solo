from setuptools import setup, find_packages

setup(
    name="rl-reward-replay",
    version="1.0.0",
    description="强化学习奖励回放系统 - 处理特征缺失、服务复核、可解释摘要",
    packages=find_packages(),
    install_requires=[
        "pyyaml>=6.0",
        "pandas>=1.5.0",
        "plotly>=5.0.0",
        "rich>=13.0.0",
        "typer>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "rl-replay=rl_reward_replay.cli:main",
        ],
    },
    python_requires=">=3.8",
)
