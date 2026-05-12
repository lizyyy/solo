#!/usr/bin/env python3
"""
异常触发路径脚本
演示各种错误场景
"""
import subprocess
import sys
from pathlib import Path
import json

def run_cmd(cmd, check=False):
    print(f"\n{'='*60}")
    print(f"执行: {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True, cwd=Path(__file__).parent)
    print(f"返回码: {result.returncode}")
    return result

def main():
    print("\n" + "#"*60)
    print("# 异常路径演示")
    print("#"*60)

    # 确保目录存在
    data_dir = Path(__file__).parent / "first_aid_data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # 异常 1: 初始化时不使用 --force 覆盖已有数据
    print("\n" + "="*60)
    print("异常 1: 尝试不使用 --force 初始化已有数据")
    print("说明: 先初始化一次，再尝试不使用 --force 再次初始化")
    print("="*60)
    run_cmd("python3 -m first_aid_cert.cli init")
    run_cmd("python3 -m first_aid_cert.cli init")

    # 异常 2: 导入不存在的文件
    print("\n" + "="*60)
    print("异常 2: 导入不存在的文件")
    print("="*60)
    run_cmd("python3 -m first_aid_cert.cli import-data /nonexistent/file.json personnel")

    # 异常 3: 导入格式错误的 JSON
    print("\n" + "="*60)
    print("异常 3: 导入格式错误的 JSON")
    print("="*60)
    bad_json = Path(__file__).parent / "bad_data.json"
    with open(bad_json, "w", encoding="utf-8") as f:
        f.write("这不是有效的 JSON")
    run_cmd(f"python3 -m first_aid_cert.cli import-data {bad_json} personnel")

    # 异常 4: 导入不支持的数据类型
    print("\n" + "="*60)
    print("异常 4: 导入不支持的数据类型")
    print("="*60)
    good_json = Path(__file__).parent / "good_data.json"
    with open(good_json, "w", encoding="utf-8") as f:
        json.dump([{"name": "测试", "employee_id": "T001"}], f, ensure_ascii=False)
    run_cmd(f"python3 -m first_aid_cert.cli import-data {good_json} invalid_type")

    # 异常 5: 更新不存在的证书
    print("\n" + "="*60)
    print("异常 5: 更新不存在的证书 ID")
    print("="*60)
    run_cmd("python3 -m first_aid_cert.cli update-certificate nonexistent_id -n FA000000")

    # 异常 6: list 不存在的实体类型
    print("\n" + "="*60)
    print("异常 6: 查看不存在的实体类型")
    print("="*60)
    run_cmd("python3 -m first_aid_cert.cli list invalid_type")

    # 异常 7: check 发现过期证书时返回非零退出码
    print("\n" + "="*60)
    print("异常 7: 检查发现过期证书时返回非零退出码")
    print("说明: 样例数据中包含已过期的证书，check 命令应返回码 2")
    print("="*60)
    run_cmd("python3 -m first_aid_cert.cli check")

    # 清理
    if bad_json.exists():
        bad_json.unlink()
    if good_json.exists():
        good_json.unlink()

    print("\n" + "="*60)
    print("异常路径演示完成！")
    print("="*60)

if __name__ == "__main__":
    main()
