#!/usr/bin/env python3
"""
离线许可证激活 CLI 测试样例脚本

场景说明：
- 客户A (CUST001)：授权2台机器，将测试正常续期流程
- 客户B (CUST002)：授权2台机器，将测试吊销流程
- 机器：machine-A1, machine-A2（客户A）, machine-B1（客户B）

执行流程：
1. 初始化：安装依赖、清理旧数据
2. 生成三台机器的指纹
3. 售后签发两个客户的许可证
4. 客户激活许可证
5. 查看授权状态
6. 测试续期（客户A）
7. 测试吊销（客户B）
8. 验证业务规则：
   - 机器数量限制：客户A尝试激活第三台机器
   - 指纹不匹配：用机器A2的指纹激活机器A1的许可证
   - 吊销后重新激活：尝试激活已吊销的许可证
9. 导出审计报告
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).parent
KEYS_DIR = BASE_DIR / "keys"
LICENSES_DIR = BASE_DIR / "licenses"
FINGERPRINTS_DIR = BASE_DIR / "fingerprints"


def run_cmd(cmd, description):
    print(f"\n{'='*60}")
    print(f"[操作] {description}")
    print(f"[命令] {cmd}")
    print(f"{'='*60}")
    result = os.system(cmd)
    print(f"[退出码] {result}")
    return result == 0


def cleanup():
    print("\n[初始化] 清理旧数据...")
    for directory in [KEYS_DIR, LICENSES_DIR, FINGERPRINTS_DIR]:
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)
    print("[完成] 旧数据已清理")


def generate_fingerprints():
    print("\n" + "="*60)
    print("第一步：生成三台机器的指纹")
    print("="*60)
    
    machines = [
        ("machine-A1", "客户A - 生产服务器1"),
        ("machine-A2", "客户A - 生产服务器2"),
        ("machine-B1", "客户B - 测试服务器")
    ]
    
    for machine_id, desc in machines:
        cmd = f"python3 -m license_cli generate-fingerprint --machine-id {machine_id} --output {machine_id}_fingerprint.json"
        run_cmd(cmd, f"生成 {desc} 的指纹")
    
    print("\n[验证] 查看生成的指纹文件:")
    for fp in FINGERPRINTS_DIR.glob("*_fingerprint.json"):
        with open(fp, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"  - {fp.name}: machine_id={data['machine_id']}, fingerprint={data['fingerprint'][:16]}...")


def issue_licenses():
    print("\n" + "="*60)
    print("第二步：售后签发许可证")
    print("="*60)
    
    print("\n[操作] 为客户A签发第1个许可证（max_machines=2，表示客户A总共最多2台机器）")
    cmd = (
        f"python3 -m license_cli issue "
        f"--customer-id CUST001 "
        f"--customer-name \"客户A科技有限公司\" "
        f"--features \"基础功能,高级分析,报表导出,API接口\" "
        f"--max-machines 2 "
        f"--validity-days 365"
    )
    success = run_cmd(cmd, "签发客户A的第1个许可证")
    
    print("\n[操作] 为客户A签发第2个许可证")
    cmd = (
        f"python3 -m license_cli issue "
        f"--customer-id CUST001 "
        f"--customer-name \"客户A科技有限公司\" "
        f"--features \"基础功能,高级分析,报表导出,API接口\" "
        f"--max-machines 2 "
        f"--validity-days 365"
    )
    success = run_cmd(cmd, "签发客户A的第2个许可证")
    
    print("\n[操作] 为客户B签发许可证")
    cmd = (
        f"python3 -m license_cli issue "
        f"--customer-id CUST002 "
        f"--customer-name \"客户B贸易公司\" "
        f"--features \"基础功能,报表导出\" "
        f"--max-machines 2 "
        f"--validity-days 90"
    )
    success = run_cmd(cmd, "签发客户B的许可证")
    
    print("\n[验证] 查看所有已签发的许可证:")
    cmd = "python3 -m license_cli list"
    run_cmd(cmd, "列出所有许可证")


def activate_licenses():
    print("\n" + "="*60)
    print("第三步：客户激活许可证")
    print("="*60)
    
    issued_file = LICENSES_DIR / "issued_licenses.json"
    with open(issued_file, 'r', encoding='utf-8') as f:
        licenses = json.load(f)
    
    lic_a_list = [l for l in licenses if l["customer_id"] == "CUST001"]
    lic_b = [l for l in licenses if l["customer_id"] == "CUST002"][0]
    
    lic_a1_file = LICENSES_DIR / f"{lic_a_list[0]['license_id']}.json"
    lic_a2_file = LICENSES_DIR / f"{lic_a_list[1]['license_id']}.json"
    lic_b_file = LICENSES_DIR / f"{lic_b['license_id']}.json"
    
    print(f"\n[操作] 客户A在机器 machine-A1 上激活许可证 {lic_a_list[0]['license_id']}")
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_a1_file} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-A1_fingerprint.json"
    )
    run_cmd(cmd, "激活客户A机器1的许可证")
    
    print(f"\n[操作] 客户A在机器 machine-A2 上激活许可证 {lic_a_list[1]['license_id']}")
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_a2_file} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-A2_fingerprint.json"
    )
    run_cmd(cmd, "激活客户A机器2的许可证")
    
    print(f"\n[操作] 客户B在机器 machine-B1 上激活许可证 {lic_b['license_id']}")
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_b_file} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-B1_fingerprint.json"
    )
    run_cmd(cmd, "激活客户B机器1的许可证")


def check_status():
    print("\n" + "="*60)
    print("第四步：查看授权状态")
    print("="*60)
    
    activated_files = list(LICENSES_DIR.glob("*_activated.json"))
    for lic_file in activated_files:
        print(f"\n[操作] 查看许可证 {lic_file.name} 的状态")
        cmd = f"python3 -m license_cli status --license {lic_file}"
        run_cmd(cmd, f"查看 {lic_file.name} 状态")


def test_renewal():
    print("\n" + "="*60)
    print("第五步：测试正常续期（客户A）")
    print("="*60)
    
    activated_files = list(LICENSES_DIR.glob("*_activated.json"))
    for lic_file in activated_files:
        with open(lic_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if data["data"]["customer_id"] == "CUST001":
                print(f"\n[操作] 为客户A的许可证续期365天")
                cmd = (
                    f"python3 -m license_cli renew "
                    f"--license {lic_file} "
                    f"--additional-days 365"
                )
                run_cmd(cmd, "续期客户A的许可证")
                
                renewed_file = LICENSES_DIR / f"{data['data']['license_id']}_renewed.json"
                if renewed_file.exists():
                    print(f"\n[验证] 查看续期后的状态:")
                    cmd = f"python3 -m license_cli status --license {renewed_file}"
                    run_cmd(cmd, "查看续期后状态")
                break


def test_revocation():
    print("\n" + "="*60)
    print("第六步：测试吊销（客户B）")
    print("="*60)
    
    issued_file = LICENSES_DIR / "issued_licenses.json"
    with open(issued_file, 'r', encoding='utf-8') as f:
        licenses = json.load(f)
    
    lic_b = [l for l in licenses if l["customer_id"] == "CUST002"][0]
    license_id = lic_b["license_id"]
    
    print(f"\n[操作] 吊销客户B的许可证 {license_id}")
    cmd = (
        f"python3 -m license_cli revoke "
        f"--license-id {license_id} "
        f"--reason \"客户B违约，终止合作\""
    )
    run_cmd(cmd, f"吊销许可证 {license_id}")
    
    print(f"\n[验证] 查看吊销后的状态:")
    activated_file = LICENSES_DIR / f"{license_id}_activated.json"
    if activated_file.exists():
        cmd = f"python3 -m license_cli status --license {activated_file}"
        run_cmd(cmd, "查看吊销后状态")


def test_business_rules():
    print("\n" + "="*60)
    print("第七步：验证业务规则")
    print("="*60)
    
    issued_file = LICENSES_DIR / "issued_licenses.json"
    with open(issued_file, 'r', encoding='utf-8') as f:
        licenses = json.load(f)
    
    print("\n" + "-"*60)
    print("测试1：机器数量限制（客户A已激活2台，尝试激活第3台）")
    print("-"*60)
    
    cmd = (
        f"python3 -m license_cli generate-fingerprint "
        f"--machine-id machine-A3 "
        f"--output machine-A3_fingerprint.json"
    )
    run_cmd(cmd, "生成第三台机器的指纹")
    
    print("\n[操作] 为客户A签发第3个许可证")
    cmd = (
        f"python3 -m license_cli issue "
        f"--customer-id CUST001 "
        f"--customer-name \"客户A科技有限公司\" "
        f"--features \"基础功能,高级分析\" "
        f"--max-machines 2 "
        f"--validity-days 365"
    )
    run_cmd(cmd, "签发客户A的第3个许可证")
    
    with open(issued_file, 'r', encoding='utf-8') as f:
        licenses = json.load(f)
    lic_a3 = [l for l in licenses if l["customer_id"] == "CUST001" and l["status"] == "inactive"][0]
    lic_a3_file = LICENSES_DIR / f"{lic_a3['license_id']}.json"
    
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_a3_file} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-A3_fingerprint.json"
    )
    run_cmd(cmd, "尝试在第3台机器上激活（应该失败，因为客户A已达到max_machines=2的限制）")
    
    print("\n" + "-"*60)
    print("测试2：指纹不匹配（用错误的机器指纹激活）")
    print("-"*60)
    
    lic_a_inactive = [l for l in licenses if l["customer_id"] == "CUST001" and l["status"] == "inactive"]
    if lic_a_inactive:
        lic_file = LICENSES_DIR / f"{lic_a_inactive[0]['license_id']}.json"
        cmd = (
            f"python3 -m license_cli activate "
            f"--license {lic_file} "
            f"--fingerprint {FINGERPRINTS_DIR}/machine-B1_fingerprint.json"
        )
        run_cmd(cmd, "用机器B1的指纹激活（应该失败，max_machines限制优先）")
    
    lic_a1 = [l for l in licenses if l["customer_id"] == "CUST001" and l["status"] == "valid"][0]
    lic_a1_activated = LICENSES_DIR / f"{lic_a1['license_id']}_activated.json"
    
    print("\n[操作] 尝试用机器A2的指纹激活已绑定机器A1的许可证")
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_a1_activated} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-A2_fingerprint.json"
    )
    run_cmd(cmd, "用不同指纹激活已绑定的许可证（应该失败，指纹不匹配）")
    
    print("\n" + "-"*60)
    print("测试3：吊销后重新激活（尝试激活已吊销的许可证）")
    print("-"*60)
    
    lic_b = [l for l in licenses if l["customer_id"] == "CUST002"][0]
    lic_b_file = LICENSES_DIR / f"{lic_b['license_id']}.json"
    
    cmd = (
        f"python3 -m license_cli activate "
        f"--license {lic_b_file} "
        f"--fingerprint {FINGERPRINTS_DIR}/machine-B1_fingerprint.json"
    )
    run_cmd(cmd, "尝试激活已吊销的许可证（应该失败）")
    
    print("\n" + "-"*60)
    print("测试4：续期已吊销的许可证")
    print("-"*60)
    
    activated_b_file = LICENSES_DIR / f"{lic_b['license_id']}_activated.json"
    if activated_b_file.exists():
        cmd = (
            f"python3 -m license_cli renew "
            f"--license {activated_b_file} "
            f"--additional-days 365"
        )
        run_cmd(cmd, "尝试续期已吊销的许可证（应该失败）")


def export_audit():
    print("\n" + "="*60)
    print("第八步：导出审计报告")
    print("="*60)
    
    cmd = "python3 -m license_cli export-audit --output final_audit_report.json"
    run_cmd(cmd, "导出最终审计报告")
    
    report_file = LICENSES_DIR / "final_audit_report.json"
    if report_file.exists():
        with open(report_file, 'r', encoding='utf-8') as f:
            report = json.load(f)
        print("\n[审计报告摘要]")
        print(json.dumps(report["summary"], indent=2, ensure_ascii=False))


def main():
    print("="*60)
    print("离线许可证激活 CLI - 完整测试样例")
    print("="*60)
    print(f"开始时间: {datetime.now().isoformat()}")
    print(f"工作目录: {BASE_DIR}")
    
    try:
        cleanup()
        generate_fingerprints()
        issue_licenses()
        activate_licenses()
        check_status()
        test_renewal()
        test_revocation()
        test_business_rules()
        export_audit()
        
        print("\n" + "="*60)
        print("测试完成！")
        print("="*60)
        print("\n[重要文件位置]")
        print(f"  密钥目录: {KEYS_DIR}")
        print(f"  许可证目录: {LICENSES_DIR}")
        print(f"  指纹目录: {FINGERPRINTS_DIR}")
        print(f"  审计报告: {LICENSES_DIR / 'final_audit_report.json'}")
        print("\n[建议复查]")
        print("  1. 查看 issued_licenses.json 确认所有许可证状态")
        print("  2. 查看 revoked_licenses.json 确认吊销记录")
        print("  3. 查看 audit_log.json 确认所有操作记录")
        print("  4. 检查 final_audit_report.json 的统计数据")
        
        return 0
        
    except Exception as e:
        print(f"\n[错误] 测试过程中发生异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
