# -*- coding: utf-8 -*-
"""GNSS 静态观测成果离线复核工具

该工具用于在提交 GNSS 静态观测成果前进行离线复核，主要功能包括：
- 解析 RINEX 观测文件（支持 RINEX 2.x 和 3.x）
- 读取基站台账 CSV 和测段计划 YAML
- 统计观测时长、采样间隔、缺历元、周跳疑点
- 验证坐标和天线高一致性
- 生成复核报告：issues.csv、rinex_report.md 和 timeline.html
"""

__version__ = "1.0.0"
__author__ = "GNSS Survey Team"
