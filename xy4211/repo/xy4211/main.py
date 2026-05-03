#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
耳机校准与筛查包核验台
用于流动听力筛查车的本地桌面工具

功能:
- 导入学生名单CSV、筛查结果JSON、设备日志JSON和校准证书
- 自动校验校准有效期、结果缺失、阈值异常和时间漂移等问题
- 支持人工复核问题并本地保存
- 导出Markdown交付报告、CSV问题清单和JSON审计包
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from gui.main_window import run_app
from config import APP_NAME, APP_VERSION


def main():
    print(f"启动 {APP_NAME} v{APP_VERSION}")
    print("=" * 50)
    run_app()


if __name__ == "__main__":
    main()
