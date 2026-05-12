#!/usr/bin/env python3
"""
最短演示路径脚本
演示急救培训证书到期 CLI 的核心功能
"""
import subprocess
import sys
from pathlib import Path

def run_cmd(cmd, check=True):
    print(f"\n{'='*60}")
    print(f"执行: {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True, cwd=Path(__file__).parent)
    if check and result.returncode != 0:
        print(f"命令执行失败，返回码: {result.returncode}")
    return result

def main():
    # 1. 初始化样例数据
    print("\n" + "#"*60)
    print("# 步骤 1: 初始化样例数据")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli init")

    # 2. 查看人员档案
    print("\n" + "#"*60)
    print("# 步骤 2: 查看人员档案")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli list personnel")

    # 3. 查看证书记录
    print("\n" + "#"*60)
    print("# 步骤 3: 查看证书记录")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli list certificates")

    # 4. 查看复训计划
    print("\n" + "#"*60)
    print("# 步骤 4: 查看复训计划")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli list retraining")

    # 5. 执行到期检查
    print("\n" + "#"*60)
    print("# 步骤 5: 执行到期检查")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli check", check=False)

    # 6. 修改一条证书记录（演示历史追踪）
    print("\n" + "#"*60)
    print("# 步骤 6: 修改证书信息（演示历史追踪）")
    print("# 说明: 先查看所有证书，然后修改第一个证书")
    print("#"*60)

    # 获取第一个证书的 ID
    import json
    data_dir = Path(__file__).parent / "first_aid_data"
    cert_file = data_dir / "certificates.json"
    if cert_file.exists():
        with open(cert_file, "r", encoding="utf-8") as f:
            certs = json.load(f)
        if certs:
            first_cert_id = certs[0]["id"]
            run_cmd(f"python3 -m first_aid_cert.cli update-certificate {first_cert_id} -n FA999999")

    # 7. 查看历史记录
    print("\n" + "#"*60)
    print("# 步骤 7: 查看操作历史（包含前后变化）")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli history --diff")

    # 8. 导出数据
    print("\n" + "#"*60)
    print("# 步骤 8: 导出所有数据")
    print("#"*60)
    run_cmd("python3 -m first_aid_cert.cli export export_all.json")

    print("\n" + "="*60)
    print("演示完成！")
    print("="*60)

if __name__ == "__main__":
    main()
