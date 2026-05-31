#!/usr/bin/env python3
"""
生成测试数据，模拟凌晨批处理的各种场景
"""
import sys
import os
import time
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from script_ledger.ledger import Ledger, ScriptRecord

def main():
    ledger_path = "script_ledger.json"
    
    if os.path.exists(ledger_path):
        os.remove(ledger_path)
    
    ledger = Ledger(ledger_path)
    
    test_scripts_dir = os.path.join(os.path.dirname(__file__), "test_scripts")
    space_dir = os.path.join(os.path.dirname(__file__), "test scripts with space")
    
    base_time = time.time() - 3600 * 4
    
    records = []
    
    # 场景1: 成功的脚本 - 应该归类为"不用动"
    r1 = ScriptRecord(
        command="python batch_process.py --date 20240530",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["result.csv"],
        note="正常执行完成",
        start_time=base_time
    )
    r1.end_time = base_time + 120
    records.append(r1)
    
    # 场景2: 失败但有失败原因（网络超时，可补跑）- 应该归类为"要补跑"
    r2 = ScriptRecord(
        command="python batch_process.py --date 20240531",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["result_20240531.csv"],
        failure_reason="网络超时，连接数据库失败",
        start_time=base_time + 180
    )
    r2.end_time = base_time + 190
    records.append(r2)
    
    # 场景3: 失败且无失败原因 - 应该归类为"要补跑"
    r3 = ScriptRecord(
        command="python report_gen.py",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["report.pdf"],
        start_time=base_time + 300
    )
    r3.end_time = base_time + 310
    records.append(r3)
    
    # 场景4: 路径包含空格但执行成功 - 应该归类为"不用动"（带警告）
    r4 = ScriptRecord(
        command="sh cleanup.sh",
        cwd=space_dir,
        exit_code=0,
        output_files=[],
        note="路径有空格但执行成功",
        start_time=base_time + 400
    )
    r4.end_time = base_time + 405
    records.append(r4)
    
    # 场景5: 同一脚本短时间内重复运行 - 应该检测出重复
    r5 = ScriptRecord(
        command="python batch_process.py --date 20240529",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["result_20240529.csv"],
        start_time=base_time + 500
    )
    r5.end_time = base_time + 520
    records.append(r5)
    
    r6 = ScriptRecord(
        command="python batch_process.py --date 20240529",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["result_20240529.csv"],
        start_time=base_time + 510
    )
    r6.end_time = base_time + 530
    records.append(r6)
    
    # 场景7: 失败原因是语法错误（需要研发确认）- 应该归类为"找研发确认"
    r7 = ScriptRecord(
        command="python data_load.py",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["loaded_data.txt"],
        failure_reason="SyntaxError: invalid syntax at line 42",
        start_time=base_time + 700
    )
    r7.end_time = base_time + 705
    records.append(r7)
    
    # 场景8: 先失败后成功，未标记补跑 - 应该检测为可疑成功
    r8 = ScriptRecord(
        command="python report_gen.py",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["report_weekly.pdf"],
        failure_reason="磁盘空间不足",
        start_time=base_time + 800
    )
    r8.end_time = base_time + 802
    records.append(r8)
    
    r9 = ScriptRecord(
        command="python report_gen.py",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["report_weekly.pdf"],
        start_time=base_time + 810
    )
    r9.end_time = base_time + 820
    records.append(r9)
    
    # 场景9: 补跑记录（成功）- 应该归类为"不用动"
    r10_id = None
    r10 = ScriptRecord(
        command="python batch_process.py --date 20240528",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["result_20240528.csv"],
        failure_reason="临时文件锁定",
        start_time=base_time + 900
    )
    r10.end_time = base_time + 905
    r10_id = ledger.add_record(r10)
    
    r11 = ScriptRecord(
        command="python batch_process.py --date 20240528",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["result_20240528.csv"],
        note="值班人李四补跑，清理锁文件后成功",
        is_rerun=True,
        rerun_of=r10_id,
        start_time=base_time + 920
    )
    r11.end_time = base_time + 940
    records.append(r11)
    
    # 场景10: 退出码为0但输出文件缺失 - 应该归类为"要补跑"
    r12 = ScriptRecord(
        command="python batch_process.py --date 20240527",
        cwd=test_scripts_dir,
        exit_code=0,
        output_files=["result_20240527_missing.csv"],
        start_time=base_time + 1000
    )
    r12.end_time = base_time + 1020
    records.append(r12)
    
    # 先执行一遍脚本确保文件存在
    import subprocess
    for r in [r1, r5, r6, r9, r11]:
        if r.exit_code == 0 and r.output_files:
            try:
                cmd_parts = r.command.split()
                subprocess.run(cmd_parts, cwd=r.cwd, capture_output=True)
            except:
                pass
    
    # 添加其他记录
    for r in records:
        ledger.add_record(r)
    
    # 创建一个用于导入测试的备份
    backup_ledger = Ledger("backup_ledger.json")
    r_import = ScriptRecord(
        command="python batch_process.py --date 20240526",
        cwd=test_scripts_dir,
        exit_code=1,
        output_files=["result_20240526.csv"],
        failure_reason="数据库连接超时",
        start_time=base_time + 1100
    )
    backup_ledger.add_record(r_import)
    
    print(f"✓ 已生成 {len(records) + 2} 条测试记录")
    print(f"  账本文件: {ledger_path}")
    print(f"  备份账本: backup_ledger.json")
    print("\n包含场景:")
    print("  1. 正常成功的脚本")
    print("  2. 失败+已知原因(网络超时)-可补跑")
    print("  3. 失败+无原因-要补跑")
    print("  4. 路径含空格+成功")
    print("  5. 同一脚本5分钟内重复执行")
    print("  6. 失败原因是语法错误-找研发")
    print("  7. 先失败后成功未标记补跑-可疑")
    print("  8. 已标记补跑+成功")
    print("  9. 退出码0但输出文件缺失")
    print("\n运行 './ledger list' 查看记录")
    print("运行 './ledger report --print' 生成报告")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
