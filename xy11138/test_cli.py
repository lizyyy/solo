#!/usr/bin/env python3
import subprocess
import sys
import os

def run_test(cmd, description):
    print(f"\n{'='*60}")
    print(f"测试: {description}")
    print(f"命令: {cmd}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print("STDOUT:")
    print(result.stdout)
    if result.stderr:
        print("STDERR:")
        print(result.stderr)
    print(f"退出码: {result.returncode}")
    return result.returncode

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    exit_codes = []

    print("瑜伽教室团课候补排序 CLI - 测试套件")

    code = run_test(
        "python yoga_queue_cli.py --help",
        "显示帮助信息"
    )
    exit_codes.append(code)

    code = run_test(
        "python yoga_queue_cli.py sample_data/流瑜伽_20240615_候补名单.csv output/ --dry-run -v",
        "试运行模式 - 单个文件"
    )
    exit_codes.append(code)

    code = run_test(
        "python yoga_queue_cli.py sample_data/流瑜伽_20240615_候补名单.csv output/流瑜伽_result.csv -v",
        "处理单个文件 - CSV输出"
    )
    exit_codes.append(code)

    code = run_test(
        "python yoga_queue_cli.py sample_data/ output/ -v",
        "处理整个目录 - 含错误文件测试部分成功"
    )
    exit_codes.append(code)

    print(f"\n{'='*60}")
    print("测试总结:")
    print(f"成功退出码(0): {exit_codes.count(0)}")
    print(f"部分成功退出码(1): {exit_codes.count(1)}")
    print(f"失败退出码(2): {exit_codes.count(2)}")
    print(f"{'='*60}")

    if 1 in exit_codes:
        print("\n✓ 检测到部分成功退出码(1)，符合预期！")

if __name__ == '__main__':
    main()
