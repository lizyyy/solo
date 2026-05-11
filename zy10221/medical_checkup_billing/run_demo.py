#!/usr/bin/env python3
"""
演示脚本：展示完整的核对流程
"""

import subprocess
import sys
import os

def run_command(cmd):
    print(f"\n{'='*60}")
    print(f"执行: {cmd}")
    print('='*60)
    result = subprocess.run(
        cmd, 
        shell=True, 
        cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.stderr:
        print("错误输出:", result.stderr)
    return result.returncode

def main():
    print("\n" + "="*60)
    print("🏥 体检中心加项收费核对工具 - 演示")
    print("="*60)
    
    print("\n📌 场景说明:")
    print("-"*60)
    print("本次演示包含以下测试场景:")
    print("  1. 张伟 (E001) - 漏收: 有加项但无收费记录")
    print("  2. 李娜 (E002) - 重复录入: 同一天同一项目录了两次")
    print("  3. 王强 (E003) - 企业套餐不允许: 核磁共振不在COMP001允许范围内")
    print("  4. 赵敏 (E004) - 正常: 胸部CT，折扣计算正确")
    print("  5. 刘洋 (E005) - 重复收费+部分退费: 同一加项收了两次，部分退费后仍欠费")
    print("  6. 陈静 (E006) - 金额不符: 应收120元，实收100元")
    print("  7. 杨帆 (E007) - 正常（已退费）: 已全额退费")
    print("  8. 周磊 (E008) - 正常: 心电图，收费正确")
    print()
    
    input("按回车开始演示...")

    steps = [
        "python3 cli.py --help",
        "python3 cli.py status",
        "python3 cli.py import-data --group data/group_checkups.json",
        "python3 cli.py import-data --employees data/employees.csv",
        "python3 cli.py import-data --packages data/packages.json",
        "python3 cli.py import-data --discounts data/discount_policies.json",
        "python3 cli.py import-data --addons data/add_ons.csv",
        "python3 cli.py import-data --payments data/payments.csv",
        "python3 cli.py import-data --refunds data/refunds.csv",
        "python3 cli.py check",
    ]
    
    for step in steps:
        run_command(step)
        if step != steps[-1]:
            input("\n按回车继续下一步...")
    
    print("\n" + "="*60)
    print("✅ 演示完成！")
    print("="*60)
    print("\n接下来可以执行:")
    print("  python3 cli.py history          # 查看历史记录")
    print("  python3 cli.py show <session_id>  # 查看详细结果")
    print("  python3 cli.py confirm <session_id> # 确认核对结果")
    print("  python3 cli.py export <session_id>  # 导出结果")

if __name__ == "__main__":
    main()
