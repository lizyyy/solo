#!/usr/bin/env python3
"""
快速测试脚本 - 验证系统核心功能
"""

import subprocess
import time
import os
import sys

def run_command(cmd, description):
    print(f"\n{'='*60}")
    print(f"测试: {description}")
    print(f"命令: {cmd}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        print(f"返回码: {result.returncode}")
        if result.stdout:
            print(f"输出:\n{result.stdout[:500]}")
        if result.stderr and result.returncode != 0:
            print(f"错误:\n{result.stderr}")
        return result.returncode == 0
    except Exception as e:
        print(f"执行失败: {e}")
        return False

def main():
    print("会展物料管理系统 - 快速测试脚本")
    print("="*60)
    
    # 检查文件是否存在
    print("\n1. 检查项目文件...")
    required_files = [
        "main.py", "models.py", "schemas.py", "crud.py",
        "database.py", "import_service.py", "requirements.txt",
        "sample_materials.csv", "README.md"
    ]
    for f in required_files:
        if os.path.exists(f):
            print(f"  ✓ {f}")
        else:
            print(f"  ✗ {f} 缺失")
    
    print("\n2. 检查Python依赖...")
    try:
        import fastapi
        import sqlalchemy
        import yaml
        import uvicorn
        print("  ✓ 核心依赖已安装")
    except ImportError as e:
        print(f"  ✗ 依赖缺失: {e}")
        print("  请运行: pip install -r requirements.txt")
    
    print("\n3. 验证代码语法...")
    for f in ["main.py", "models.py", "schemas.py", "crud.py", "database.py", "import_service.py"]:
        if os.path.exists(f):
            result = subprocess.run(f"python -m py_compile {f}", shell=True, capture_output=True)
            if result.returncode == 0:
                print(f"  ✓ {f} 语法正确")
            else:
                print(f"  ✗ {f} 语法错误")
    
    print("\n" + "="*60)
    print("测试完成！")
    print("\n下一步操作:")
    print("  1. 安装依赖: pip install -r requirements.txt")
    print("  2. 启动服务: python main.py")
    print("  3. 访问API文档: http://localhost:8000/docs")
    print("  4. 导入物料: curl -X POST -F 'file=@sample_materials.csv' http://localhost:8000/api/import/materials/csv/")
    print("  5. 初始化测试数据: python init_test_data.py")
    print("\n完整流程请参考 README.md")

if __name__ == "__main__":
    main()
