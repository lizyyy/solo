#!/usr/bin/env python3
"""
航空配餐调度复核工具 - 启动入口
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app

if __name__ == '__main__':
    print("=" * 60)
    print("  航空配餐调度复核工具")
    print("  Catering Verification Tool")
    print("=" * 60)
    print()
    print("启动中...")
    print(f"服务地址: http://localhost:8080")
    print(f"数据目录: {app.config['DATA_DIR']}")
    print(f"样本目录: {app.config['SAMPLES_DIR']}")
    print()
    print("使用说明:")
    print("  1. 打开浏览器访问 http://localhost:8080")
    print("  2. 点击 '导入样本数据' 或手动导入数据文件")
    print("  3. 从左侧选择航班查看详情")
    print("=" * 60)
    print()
    
    app.run(debug=True, port=8080, host='0.0.0.0')
