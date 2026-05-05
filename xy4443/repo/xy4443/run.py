#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潮间带样方复盘工具 - 启动脚本
"""

import os
import sys

# 添加当前目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app import app

if __name__ == '__main__':
    print("=" * 50)
    print("🌊 潮间带样方复盘工具")
    print("=" * 50)
    print("\n📋 功能说明：")
    print("  - 数据导入：上传物种CSV、环境CSV和照片")
    print("  - 自动分析：检测入侵种、缺测、异常死亡、环境异常")
    print("  - 物种多样性：计算丰富度、优势度、Simpson指数")
    print("  - 人工复核：保存复核状态，刷新不丢失")
    print("  - 报告导出：导出Markdown报告和JSON明细")
    print("\n🚀 正在启动服务器...")
    print("   请在浏览器中访问：http://localhost:5001")
    print("   按 Ctrl+C 停止服务器\n")
    
    # 启动Flask服务器
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True,
        use_reloader=False
    )
