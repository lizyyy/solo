"""镀镍槽补加推演器 - 安装配置"""

from setuptools import setup, find_packages

setup(
    name="nickel-plating-calculator",
    version="1.0.0",
    description="给五金电镀小厂化验员用的本地科学计算工具",
    long_description="""
镀镍槽补加推演器
==================

给五金电镀小厂化验员用的本地科学计算工具。

主要功能:
- 导入滴定化验 CSV 数据
- 换算槽液浓度
- 计算硫酸镍、氯化镍、硼酸补加量
- 模拟补加后的槽液区间
- 检测 pH 调整冲突
- 检查药剂库存
- 风险评估
- 两套方案对比
- 人工放行记录
- 导出 Markdown 作业单、CSV 批次表、JSON 审计包
    """,
    author="Solocoder",
    packages=find_packages(),
    install_requires=[],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "nickel-plating-calc=nickel_plating_calculator.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Manufacturing",
        "Intended Audience :: Science/Research",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Chemistry",
        "Topic :: Utilities",
    ],
    keywords=[
        "nickel plating",
        "electroplating",
        "chemistry",
        "calculator",
        "titration",
        "电镀",
        "镀镍",
        "滴定",
    ],
)
