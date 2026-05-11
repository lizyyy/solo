#!/usr/bin/env python3
"""快速启动脚本 - 演示如何使用冷链温控异常追溯 CLI"""

import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("冷链温控异常追溯系统 - 快速演示")
    print("=" * 60)
    print()
    
    print("1. 检查依赖...")
    try:
        import yaml
        print("   ✓ PyYAML 已安装")
    except ImportError:
        print("   ✗ PyYAML 未安装，正在安装...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        import yaml
        print("   ✓ 依赖安装完成")
    print()
    
    print("2. 检查示例数据文件...")
    example_files = [
        "examples/temperature.csv",
        "examples/vehicle_route.csv",
        "examples/nodes.csv",
        "examples/signoff.csv",
        "examples/batches.csv",
        "examples/thresholds.csv",
        "examples/config.yaml"
    ]
    
    all_exist = True
    for f in example_files:
        if os.path.exists(f):
            print(f"   ✓ {f}")
        else:
            print(f"   ✗ {f} 不存在")
            all_exist = False
    
    if not all_exist:
        print()
        print("错误：部分示例文件缺失，请检查文件结构")
        sys.exit(1)
    print()
    
    print("3. 运行追溯分析（文本格式报告）...")
    cmd = [
        sys.executable, "cold_chain_trace.py",
        "--config", "examples/config.yaml",
        "--format", "text"
    ]
    print(f"   命令: {' '.join(cmd)}")
    print()
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    
    if result.returncode != 0:
        print("错误：执行失败")
        if result.stderr:
            print("错误信息：")
            print(result.stderr)
        sys.exit(result.returncode)
    
    print("4. 运行追溯分析（HTML格式报告）...")
    cmd = [
        sys.executable, "cold_chain_trace.py",
        "--config", "examples/config.yaml",
        "--format", "html"
    ]
    print(f"   命令: {' '.join(cmd)}")
    print()
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    
    if result.returncode != 0:
        print("错误：执行失败")
        if result.stderr:
            print("错误信息：")
            print(result.stderr)
        sys.exit(result.returncode)
    
    print("=" * 60)
    print("演示完成！")
    print("=" * 60)
    print()
    print("报告文件已生成在 reports/ 目录下")
    print("HTML报告可以在浏览器中打开查看")
    print()
    print("接下来：")
    print("1. 查看 reports/ 目录下的报告文件")
    print("2. 替换示例数据为您的实际数据")
    print("3. 根据 README.md 调整配置文件")
    print()

if __name__ == "__main__":
    main()
